"use client";

import React, { useState, useRef, useEffect } from "react";
import { Folder, File, Upload, Trash, Download, Eye, FileText, Image as ImageIcon, X, Edit2 } from "lucide-react";

type FileItem = {
  name: string;
  type: "d" | "-" | "l";
  size: number;
  modifyTime: number;
  rights: any;
};

export default function FileManager({ initialPath = "/upload", initialItems = [] }: { initialPath?: string; initialItems?: FileItem[] }) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [items, setItems] = useState<FileItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview state
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sftp/list?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error("Failed to list directory");
      const data = await res.json();
      setItems(data);
      setCurrentPath(path);
      setPreviewItem(null); // Clear preview on navigation
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If we have initialItems but it's empty, or we want to navigate, we should fetch.
    // For initial load, we assume initialItems are provided by server component.
    if (initialItems.length === 0 && currentPath === "/upload") {
      fetchDirectory(currentPath);
    }
  }, []);

  const handleNavigate = (newPath: string) => {
    fetchDirectory(newPath);
  };

  const handleBreadcrumbClick = (index: number) => {
    const parts = currentPath.split("/").filter(Boolean);
    const newPath = "/" + parts.slice(0, index + 1).join("/");
    handleNavigate(newPath);
  };

  const breadcrumbParts = currentPath.split("/").filter(Boolean);

  const handleUpload = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      setError("File exceeds 100MB limit.");
      return;
    }

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("path", currentPath);
    formData.append("file", file);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        setUploadProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 201) {
        fetchDirectory(currentPath);
        setUploadProgress(null);
      } else {
        setError(`Upload failed: ${xhr.statusText}`);
        setUploadProgress(null);
      }
    };

    xhr.onerror = () => {
      setError("Upload failed due to network error.");
      setUploadProgress(null);
    };

    xhr.open("POST", "/api/sftp/upload");
    xhr.send(formData);
  };

  const handleDelete = async (itemName: string) => {
    try {
      const targetPath = currentPath === "/" ? `/${itemName}` : `${currentPath}/${itemName}`;
      const res = await fetch(`/api/sftp/delete?path=${encodeURIComponent(targetPath)}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete");
      fetchDirectory(currentPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDownload = (itemName: string) => {
    const targetPath = currentPath === "/" ? `/${itemName}` : `${currentPath}/${itemName}`;
    // Using simple a tag for download to trigger browser download
    const url = `/api/sftp/download?path=${encodeURIComponent(targetPath)}`;
    window.location.href = url;
  };

  const handlePreview = async (item: FileItem) => {
    setPreviewItem(item);
    setPreviewContent(null);
    setPreviewUrl(null);

    const targetPath = currentPath === "/" ? `/${item.name}` : `${currentPath}/${item.name}`;
    const url = `/api/sftp/download?path=${encodeURIComponent(targetPath)}`;

    // Text extension check
    const isText = item.name.match(/\.(txt|md|json|csv|log)$/i);
    const isImage = item.name.match(/\.(png|jpe?g|gif|webp|svg)$/i);

    if (isImage) {
      setPreviewUrl(url);
    } else if (isText) {
      try {
        const res = await fetch(url);
        const text = await res.text();
        setPreviewContent(text);
      } catch (err) {
        setPreviewContent("Failed to load text preview.");
      }
    }
  };

  const handleRename = async (oldName: string) => {
    const newName = prompt("Enter new name:", oldName);
    if (!newName || newName === oldName) return;

    try {
      const fromPath = currentPath === "/" ? `/${oldName}` : `${currentPath}/${oldName}`;
      const toPath = currentPath === "/" ? `/${newName}` : `${currentPath}/${newName}`;

      const res = await fetch("/api/sftp/rename", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromPath, toPath })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to rename");
      }

      fetchDirectory(currentPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100">
      {/* Top Bar & Breadcrumbs */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 border-b">
        <div data-test-id="breadcrumbs" className="flex items-center space-x-2 text-sm font-medium">
          <button
            onClick={() => handleNavigate("/")}
            className="hover:text-blue-600 transition-colors"
          >
            Root
          </button>
          {breadcrumbParts.map((part: string, index: number) => (
            <div key={index} className="flex items-center space-x-2">
              <span className="text-gray-400">/</span>
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className="hover:text-blue-600 transition-colors"
              >
                {part}
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center space-x-4">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Upload size={16} />
            <span>Upload File</span>
          </button>
        </div>
      </header>

      {/* Upload Progress */}
      {uploadProgress !== null && (
        <div className="bg-blue-50 px-6 py-2 border-b">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium text-blue-800">Uploading...</span>
            <span className="font-medium text-blue-800">{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              data-test-id="upload-progress-bar"
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 px-6 py-3 border-b text-sm font-medium">
          {error}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar: Directory Tree */}
        <aside data-test-id="directory-tree" className="w-64 bg-gray-100 dark:bg-zinc-900 border-r overflow-y-auto p-4 hidden md:block">
          <h3 className="font-semibold mb-4 text-sm text-gray-500 uppercase tracking-wider">Directories</h3>
          <ul className="space-y-1">
            <li
              className={`flex items-center space-x-2 p-2 rounded cursor-pointer ${currentPath === '/upload' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'hover:bg-gray-200 dark:hover:bg-zinc-800'}`}
              onClick={() => handleNavigate('/upload')}
            >
              <Folder size={16} />
              <span>/upload</span>
            </li>
            {/* Simplistic tree showing subdirectories of current path for now */}
            {items.filter((i: FileItem) => i.type === 'd').map((dir: FileItem) => (
              <li
                key={dir.name}
                className="flex items-center space-x-2 p-2 pl-6 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-800"
                onClick={() => handleNavigate(currentPath === '/' ? `/${dir.name}` : `${currentPath}/${dir.name}`)}
              >
                <Folder size={16} />
                <span>{dir.name}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* Center: File List View */}
        <main data-test-id="file-list-view" className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item: FileItem) => (
                <div
                  key={item.name}
                  data-test-id={item.type === "d" ? "dir-item" : "file-item"}
                  className="bg-white dark:bg-zinc-900 p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow group relative"
                >
                  <div className="flex items-start space-x-3 mb-3">
                    <div className={`p-2 rounded-lg ${item.type === 'd' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                      {item.type === "d" ? <Folder size={24} /> : <File size={24} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" title={item.name}>{item.name}</p>
                      <p className="text-xs text-gray-500">{item.type === "d" ? "Folder" : `${(item.size / 1024).toFixed(1)} KB`}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.type === "d" ? (
                      <>
                        <button
                          onClick={() => handleNavigate(currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Open folder"
                        >
                          <Folder size={16} />
                        </button>
                        <button
                          onClick={() => handleRename(item.name)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="Rename"
                        >
                          <Edit2 size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handlePreview(item)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                          title="Preview"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleRename(item.name)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="Rename"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDownload(item.name)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(item.name)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-400">
                  Directory is empty
                </div>
              )}
            </div>
          )}
        </main>

        {/* Right Sidebar: Preview Panel */}
        {previewItem && (
          <aside data-test-id="preview-panel" className="w-80 bg-white dark:bg-zinc-900 border-l flex flex-col items-center p-6 shadow-xl z-10 relative">
            <button
              onClick={() => setPreviewItem(null)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <div className="h-24 w-24 bg-gray-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
              {previewItem.name.match(/\.(png|jpe?g|gif|webp|svg)$/i) ? <ImageIcon size={48} className="text-gray-400" /> : <FileText size={48} className="text-gray-400" />}
            </div>

            <h3 className="font-semibold text-lg text-center break-all mb-1">{previewItem.name}</h3>
            <p className="text-sm text-gray-500 mb-6">{(previewItem.size / 1024).toFixed(2)} KB • {new Date(previewItem.modifyTime).toLocaleDateString()}</p>

            <div className="w-full bg-gray-50 dark:bg-zinc-950 border rounded-lg overflow-hidden min-h-[200px] flex items-center justify-center p-4 mb-6">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img data-test-id="preview-image" src={previewUrl} alt={previewItem.name} className="max-w-full max-h-[300px] object-contain" />
              ) : previewContent ? (
                <div className="w-full max-h-[300px] overflow-y-auto text-xs font-mono text-left">
                  <pre data-test-id="preview-text">{previewContent}</pre>
                </div>
              ) : (
                <div data-test-id="preview-unsupported" className="text-center text-gray-400">
                  <p className="text-sm mb-4">Preview not available</p>
                  <button
                    onClick={() => handleDownload(previewItem.name)}
                    className="bg-blue-600 text-white px-4 py-2 rounded shadow text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Download File
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => handleDownload(previewItem.name)}
              className="w-full py-2 border border-gray-300 rounded font-medium shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition"
            >
              Download
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
