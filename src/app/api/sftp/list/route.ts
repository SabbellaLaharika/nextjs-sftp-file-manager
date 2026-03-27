import { NextRequest, NextResponse } from "next/server";
import { listDirectory } from "@/lib/sftp";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  try {
    const list = await listDirectory(path);
    return NextResponse.json(list);
  } catch (err: any) {
    console.error("sftp list error:", err);
    if (err.code === 2 || err.message === "No such file") {
      return NextResponse.json({ error: "Directory not found" }, { status: 404 });
    }
    if (err.code === 3 || err.message === "Permission denied") {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to list directory" }, { status: 500 });
  }
}
