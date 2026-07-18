import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import { DISCLAIMER } from "@/lib/constants/nav";

export async function GET() {
  try {
    await requireAdmin();
    const notes = await prisma.marketNote.findMany({
      orderBy: { publishedAt: "desc" },
      take: 50,
      include: { author: { select: { name: true, email: true } } },
    });
    return jsonOk({
      notes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        isActive: n.isActive,
        publishedAt: n.publishedAt.toISOString(),
        author: n.author.name ?? n.author.email,
      })),
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    const noteBody = String(body.body ?? "").trim();
    if (!title || !noteBody) {
      return jsonError(new Error("title ve body gerekli."));
    }

    const note = await prisma.marketNote.create({
      data: {
        authorId: admin.id,
        title,
        body: noteBody,
        isActive: true,
      },
    });

    return jsonOk({
      id: note.id,
      title: note.title,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const id = String(body.id ?? "");
    if (!id) return jsonError(new Error("id gerekli."));

    const data: { isActive?: boolean; title?: string; body?: string } = {};
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.title !== undefined) data.title = String(body.title);
    if (body.body !== undefined) data.body = String(body.body);

    const updated = await prisma.marketNote.update({ where: { id }, data });
    return jsonOk({ id: updated.id, isActive: updated.isActive });
  } catch (error) {
    return jsonError(error);
  }
}
