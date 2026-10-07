import "server-only";
import { isObjectId } from "@/lib/object-id";
import { cache } from "react";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { Character } from "@/lib/models/character";
import { requireUserId } from "@/lib/projects";
import type { CharacterRole } from "@/lib/character-config";

export type SerializedCharacterSummary = {
  id: string;
  name: string;
  role: CharacterRole;
  imageUrl?: string;
  appearance?: string;
};

export type SerializedCharacter = SerializedCharacterSummary & {
  projectId: string;
  aliases: string[];
  personality?: string;
  backstory?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

function serializeSummary(doc: Record<string, unknown>): SerializedCharacterSummary {
  return {
    id: String(doc._id),
    name: doc.name as string,
    role: (doc.role as CharacterRole) ?? "supporting",
    imageUrl: (doc.imageUrl as string) || undefined,
    appearance: (doc.appearance as string) || undefined,
  };
}

function serializeCharacter(doc: Record<string, unknown>): SerializedCharacter {
  return {
    ...serializeSummary(doc),
    projectId: String(doc.projectId),
    aliases: (doc.aliases as string[]) ?? [],
    personality: (doc.personality as string) || undefined,
    backstory: (doc.backstory as string) || undefined,
    notes: (doc.notes as string) || undefined,
    createdAt: new Date(doc.createdAt as string).toISOString(),
    updatedAt: new Date(doc.updatedAt as string).toISOString(),
  };
}

export async function listCharactersForProject(
  projectId: string
): Promise<SerializedCharacterSummary[]> {
  const userId = await requireUserId();
  await connectDB();
  const docs = await Character.find({ projectId, ownerId: userId })
    .sort({ name: 1 })
    .lean<Record<string, unknown>[]>();
  return docs.map(serializeSummary);
}

export const requireCharacter = cache(async (
  projectId: string,
  characterId: string
): Promise<SerializedCharacter> => {
  const userId = await requireUserId();
  await connectDB();

  // A malformed id is "not found"; a real database error is left to propagate
  // (reported as an error) instead of being hidden as a 404.
  if (!isObjectId(projectId) || !isObjectId(characterId)) notFound();
  const doc = await Character.findOne({
      _id: characterId,
      projectId,
      ownerId: userId,
    }).lean<Record<string, unknown>>();
  if (!doc) notFound();

  return serializeCharacter(doc);
});
