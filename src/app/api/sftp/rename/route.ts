import { NextRequest, NextResponse } from "next/server";
import { getSftp } from "@/lib/sftp";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromPath, toPath } = body;

    if (!fromPath || !toPath) {
      return NextResponse.json(
        { error: "Both fromPath and toPath are required" },
        { status: 400 }
      );
    }

    const sftp = await getSftp();

    return await new Promise((resolve) => {
      sftp.rename(fromPath, toPath, (err: any) => {
        if (err) {
          console.error("sftp.rename error:", err);
          if (err.code === 2 || err.message === "No such file") {
            return resolve(NextResponse.json({ error: "Source resource not found" }, { status: 404 }));
          }
          if (err.code === 3 || err.message === "Permission denied") {
            return resolve(NextResponse.json({ error: "Permission denied" }, { status: 403 }));
          }
          return resolve(NextResponse.json({ error: "Failed to rename resource" }, { status: 500 }));
        }

        resolve(NextResponse.json({
          message: "Resource renamed successfully",
          fromPath,
          toPath
        }, { status: 200 }));
      });
    });
  } catch (err: any) {
    console.error("SFTP error on rename:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
