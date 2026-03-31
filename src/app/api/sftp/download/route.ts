import { NextRequest, NextResponse } from "next/server";
import { getSftp } from "@/lib/sftp";
import { basename } from "path";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  try {
    const sftp = await getSftp();
    
    // First, stat the file to get size and ensure it exists
    return await new Promise<NextResponse>((resolve) => {
      sftp.stat(path, (statErr: any, stats: any) => {
        if (statErr) {
          console.error("sftp.stat error:", statErr);
          if (statErr.code === 2 || statErr.message === "No such file") {
            return resolve(NextResponse.json({ error: "File not found" }, { status: 404 }));
          }
          if (statErr.code === 3 || statErr.message === "Permission denied") {
            return resolve(NextResponse.json({ error: "Permission denied" }, { status: 403 }));
          }
          return resolve(NextResponse.json({ error: "Failed to access file" }, { status: 500 }));
        }

        if (stats.isDirectory()) {
          return resolve(NextResponse.json({ error: "Path is a directory, not a file" }, { status: 400 }));
        }

        const readStream = sftp.createReadStream(path);
        
        // Handle client abort to cleanly terminate the SFTP read stream
        request.signal.addEventListener("abort", () => {
          console.log(`Client aborted download for: ${path}`);
          readStream.destroy();
        });

        const webStream = new ReadableStream({
          start(controller) {
            readStream.on("data", (chunk: any) => {
              controller.enqueue(chunk);
            });
            readStream.on("end", () => {
              controller.close();
              console.log(`Finished download stream for: ${path}`);
            });
            readStream.on("error", (err: any) => {
              console.error("readStream error:", err);
              controller.error(err);
            });
          },
          cancel() {
            readStream.destroy();
          }
        });

        const filename = basename(path) || "download";
        
        const response = new NextResponse(webStream, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": stats.size.toString(),
          },
        });

        resolve(response);
      });
    });
  } catch (err: any) {
    console.error("sftp connection error:", err);
    return NextResponse.json({ error: "Connection error" }, { status: 500 });
  }
}
