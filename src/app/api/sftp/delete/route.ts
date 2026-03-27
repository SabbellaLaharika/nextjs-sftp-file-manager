import { NextRequest, NextResponse } from "next/server";
import { getSftp } from "@/lib/sftp";

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  try {
    const sftp = await getSftp();

    return await new Promise((resolve) => {
      // First stat the path to see if it's a directory or a file
      sftp.stat(path, (err: any, stats: any) => {
        if (err) {
          if (err.code === 2 || err.message === "No such file") {
            return resolve(NextResponse.json({ error: "Resource not found" }, { status: 404 }));
          }
          return resolve(NextResponse.json({ error: "Failed to stat resource" }, { status: 500 }));
        }

        if (stats.isDirectory()) {
          sftp.rmdir(path, (rmdirErr: any) => {
            if (rmdirErr) {
              return resolve(NextResponse.json({ error: "Failed to delete directory. It might not be empty." }, { status: 500 }));
            }
            resolve(NextResponse.json({
              message: "Resource deleted successfully",
              path: path
            }, { status: 200 }));
          });
        } else {
          sftp.unlink(path, (unlinkErr: any) => {
            if (unlinkErr) {
              return resolve(NextResponse.json({ error: "Failed to delete file" }, { status: 500 }));
            }
            resolve(NextResponse.json({
              message: "Resource deleted successfully",
              path: path
            }, { status: 200 }));
          });
        }
      });
    });
  } catch (err: any) {
    console.error("SFTP error on delete:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
