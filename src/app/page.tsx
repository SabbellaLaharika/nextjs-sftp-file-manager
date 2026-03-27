import FileManager from "@/components/FileManager";
import { listDirectory } from "@/lib/sftp";
import { Suspense } from "react";

async function InitialDataFetcher() {
  try {
    const initialItems = await listDirectory("/upload");
    return <FileManager initialPath="/upload" initialItems={initialItems} />;
  } catch (error) {
    console.error("Failed to load initial directory:", error);
    return <FileManager initialPath="/upload" initialItems={[]} />;
  }
}

export default function Home() {
  return (
    <main className="h-screen w-full bg-gray-50 flex items-center justify-center">
       <Suspense fallback={
         <div className="flex flex-col items-center justify-center space-y-4">
           <div className="animate-pulse bg-blue-200 h-10 w-48 rounded-md"></div>
           <div className="animate-pulse bg-gray-200 h-8 w-64 rounded-md"></div>
           <div className="animate-pulse bg-gray-200 h-64 w-[80vw] rounded-xl mt-8"></div>
           <p className="text-gray-500 font-medium">Connecting to SFTP...</p>
         </div>
       }>
         <InitialDataFetcher />
       </Suspense>
    </main>
  );
}
