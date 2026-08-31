import { NextRequest, NextResponse } from "next/server";

import { getActiveOrganization, requirePermission, requireSession } from "@/lib/auth/session";

import { uploadAndParseResume, bulkUploadResumes, uploadZipResumes } from "@/lib/services/candidate-service";

import { revalidateOrgPaths } from "@/lib/realtime/sync";

import { guessMimeType } from "@/lib/upload/mime";

import { apiErrorResponse } from "@/lib/api-error";



export const maxDuration = 120;



const MAX_FILE_SIZE = 10 * 1024 * 1024;



async function notifyCandidateUpload() {

  const session = await requireSession();

  const member = await getActiveOrganization(session.user.id);

  if (!member) return;

  await revalidateOrgPaths(["/candidates", "/dashboard"], {

    organizationId: member.organizationId,

    type: "candidates",

  });

}



export async function POST(request: NextRequest) {

  try {
    await requirePermission("create_job");

    const formData = await request.formData();

    const type = (formData.get("type") as string) ?? "single";



    if (type === "bulk") {

      const files = formData.getAll("files") as File[];

      if (files.length === 0) {

        return NextResponse.json({ error: "No files provided" }, { status: 400 });

      }

      for (const f of files) {

        if (f.size > MAX_FILE_SIZE) {

          return NextResponse.json({ error: `${f.name} exceeds 10MB limit` }, { status: 400 });

        }

      }

      const parsed = await Promise.all(

        files.map(async (f) => ({

          buffer: Buffer.from(await f.arrayBuffer()),

          fileName: f.name,

          mimeType: guessMimeType(f.name, f.type),

        })),

      );

      const results = await bulkUploadResumes(parsed);

      await notifyCandidateUpload();

      return NextResponse.json({ results });

    }



    const file = formData.get("file") as File | null;

    if (!file?.size) {

      return NextResponse.json({ error: "No file provided" }, { status: 400 });

    }

    if (file.size > MAX_FILE_SIZE) {

      return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });

    }



    const buffer = Buffer.from(await file.arrayBuffer());

    if (type === "zip") {

      const results = await uploadZipResumes(buffer);

      if (results.length === 0) {

        return NextResponse.json(

          { error: "ZIP contained no valid resume files (.pdf, .doc, .docx, .rtf, .txt, .png, .jpg)" },

          { status: 400 },

        );

      }

      await notifyCandidateUpload();

      return NextResponse.json({ results });

    }



    const result = await uploadAndParseResume(

      buffer,

      file.name,

      guessMimeType(file.name, file.type),

    );

    await notifyCandidateUpload();

    return NextResponse.json(result);

  } catch (error) {
    return apiErrorResponse(error);

  }

}


