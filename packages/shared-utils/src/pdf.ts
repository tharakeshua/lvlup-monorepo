export async function convertPdfToImages(file: File): Promise<string[]> {
  // Dynamic import to avoid SSR issues - use legacy build
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Set worker source to CDN using legacy build
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better quality
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) continue;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      canvas,
      viewport,
    }).promise;

    // Convert to Base64 (JPEG)
    const base64 = canvas.toDataURL("image/jpeg", 0.8);
    images.push(base64); // "data:image/jpeg;base64,..."
  }

  return images;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
