import { NextRequest, NextResponse } from "next/server";
import { getSftp } from "@/lib/sftp";
import Busboy from "busboy";
import { Readable } from "node:stream";
import pathModule from "path";

// In Next.js App Router, we handle streaming via node:stream Readable.fromWeb
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
    }

    if (!request.body) {
      return NextResponse.json({ error: "Request body is empty" }, { status: 400 });
    }

    const sftp = await getSftp();
    
    return await new Promise<NextResponse>((resolve, reject) => {
      const busboy = Busboy({
        headers: {
          "content-type": contentType,
        },
        limits: {
          fileSize: 100 * 1024 * 1024, // 100MB limit
        },
      });

      let destinationPath = "/";
      let fileCount = 0;
      let uploadError: string | null = null;
      let uploadedFilePath = "";
      
      busboy.on("field", (name, value) => {
        if (name === "path") {
          destinationPath = value;
        }
      });

      busboy.on("file", (name, file, info) => {
        fileCount++;
        const { filename } = info;
        // Construct the full path
        uploadedFilePath = destinationPath === "/" ? `/${filename}` : `${destinationPath}/${filename}`;
        uploadedFilePath = pathModule.posix.normalize(uploadedFilePath);

        const writeStream = sftp.createWriteStream(uploadedFilePath);

        file.on("limit", () => {
          uploadError = "File too large (100MB limit)";
          writeStream.destroy();
          // To cleanly stop parsing:
          request.signal.dispatchEvent(new Event("abort"));
        });

        file.pipe(writeStream);

        writeStream.on("close", () => {
          console.log(`Successfully uploaded: ${uploadedFilePath}`);
        });

        writeStream.on("error", (err: any) => {
          console.error("sftp write error:", err);
          uploadError = "Failed to write file to SFTP";
        });
      });

      busboy.on("close", () => {
        if (uploadError === "File too large (100MB limit)") {
           return resolve(NextResponse.json({ error: uploadError }, { status: 413 }));
        }
        if (uploadError) {
           return resolve(NextResponse.json({ error: uploadError }, { status: 500 }));
        }
        if (fileCount === 0) {
           return resolve(NextResponse.json({ error: "No file provided" }, { status: 400 }));
        }

        resolve(NextResponse.json({
          message: "File uploaded successfully",
          filePath: uploadedFilePath
        }, { status: 201 }));
      });
      
      busboy.on("error", (err) => {
         console.error("Busboy error:", err);
         resolve(NextResponse.json({ error: "Error parsing upload" }, { status: 500 }));
      });

      // Stream the raw body into busboy using Node.js stream API
      const nodeStream = Readable.fromWeb(request.body as import("stream/web").ReadableStream);
      nodeStream.pipe(busboy);
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
