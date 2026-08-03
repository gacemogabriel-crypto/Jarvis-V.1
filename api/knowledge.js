import { createClient } from "@supabase/supabase-js";

export const maxDuration = 30;

function jsonResponse(data, status = 200) {
  return Response.json(data, { status });
}

function createSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }

  return createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}

function cleanString(value, fallback = null) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.trim();

  return cleaned || fallback;
}

function cleanStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter(item => typeof item === "string")
        .map(item => item.trim())
        .filter(Boolean)
    )
  ];
}

export default {
  async fetch(request) {
    try {
      const supabase = createSupabaseAdmin();
      const url = new URL(request.url);

      if (request.method === "GET") {
        const entityId = url.searchParams.get("id");
        const search = url.searchParams
          .get("search")
          ?.trim();

        if (entityId) {
          const { data, error } = await supabase
            .from("knowledge_entities")
            .select(
              `
                *,
                visual_memories (
                  id,
                  storage_path,
                  original_filename,
                  mime_type,
                  perceptual_hash,
                  description,
                  created_at
                )
              `
            )
            .eq("id", entityId)
            .single();

          if (error) {
            return jsonResponse(
              { error: error.message },
              error.code === "PGRST116" ? 404 : 500
            );
          }

          return jsonResponse({ entity: data });
        }

        let query = supabase
          .from("knowledge_entities")
          .select("*")
          .order("updated_at", {
            ascending: false
          })
          .limit(100);

        if (search) {
          query = query.or(
            [
              `name.ilike.%${search}%`,
              `description.ilike.%${search}%`,
              `universe.ilike.%${search}%`,
              `category.ilike.%${search}%`
            ].join(",")
          );
        }

        const { data, error } = await query;

        if (error) {
          return jsonResponse(
            { error: error.message },
            500
          );
        }

        return jsonResponse({
          entities: data || []
        });
      }

      if (request.method === "POST") {
        const body = await request.json();

        const name = cleanString(body.name);

        if (!name) {
          return jsonResponse(
            { error: "An entity name is required." },
            400
          );
        }

        const newEntity = {
          name,
          entity_type:
            cleanString(body.entityType, "unknown"),
          universe: cleanString(body.universe),
          category: cleanString(body.category),
          description: cleanString(body.description),
          aliases: cleanStringArray(body.aliases),
          tags: cleanStringArray(body.tags),
          source: cleanString(body.source, "user"),
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from("knowledge_entities")
          .insert(newEntity)
          .select()
          .single();

        if (error) {
          return jsonResponse(
            { error: error.message },
            500
          );
        }

        return jsonResponse(
          { entity: data },
          201
        );
      }

      if (request.method === "PATCH") {
        const body = await request.json();
        const id = cleanString(body.id);

        if (!id) {
          return jsonResponse(
            { error: "An entity ID is required." },
            400
          );
        }

        const updates = {
          updated_at: new Date().toISOString()
        };

        if ("name" in body) {
          updates.name = cleanString(body.name);
        }

        if ("entityType" in body) {
          updates.entity_type = cleanString(
            body.entityType,
            "unknown"
          );
        }

        if ("universe" in body) {
          updates.universe =
            cleanString(body.universe);
        }

        if ("category" in body) {
          updates.category =
            cleanString(body.category);
        }

        if ("description" in body) {
          updates.description =
            cleanString(body.description);
        }

        if ("aliases" in body) {
          updates.aliases =
            cleanStringArray(body.aliases);
        }

        if ("tags" in body) {
          updates.tags =
            cleanStringArray(body.tags);
        }

        if ("source" in body) {
          updates.source = cleanString(
            body.source,
            "user"
          );
        }

        const { data, error } = await supabase
          .from("knowledge_entities")
          .update(updates)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          return jsonResponse(
            { error: error.message },
            error.code === "PGRST116" ? 404 : 500
          );
        }

        return jsonResponse({ entity: data });
      }

      if (request.method === "DELETE") {
        const body = await request.json();
        const id = cleanString(body.id);

        if (!id) {
          return jsonResponse(
            { error: "An entity ID is required." },
            400
          );
        }

        const { error } = await supabase
          .from("knowledge_entities")
          .delete()
          .eq("id", id);

        if (error) {
          return jsonResponse(
            { error: error.message },
            500
          );
        }

        return jsonResponse({
          success: true
        });
      }

      return jsonResponse(
        { error: "Method not allowed." },
        405
      );
    } catch (error) {
      return jsonResponse(
        {
          error:
            error?.message ||
            "Unknown knowledge-system error."
        },
        500
      );
    }
  }
};