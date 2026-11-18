import type { TicketAttachment } from '../types/finance';

export const MAX_SUPPORT_ATTACHMENTS = 2;
const MAX_DATA_URL_LENGTH = 380000;
const MAX_RAW_NON_IMAGE_BYTES = 260000;

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo leer el archivo.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo adjunto.'));
    reader.readAsDataURL(file);
  });
}

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1200;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > 0.35) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        URL.revokeObjectURL(objectUrl);
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          reject(new Error(`La imagen "${file.name}" sigue siendo demasiado pesada.`));
          return;
        }
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`No se pudo cargar la imagen "${file.name}".`));
    };
    img.src = objectUrl;
  });
}

export async function processSupportAttachments(
  files: FileList | File[],
  existingCount = 0
): Promise<TicketAttachment[]> {
  const list = Array.from(files);
  const availableSlots = Math.max(0, MAX_SUPPORT_ATTACHMENTS - existingCount);
  if (availableSlots === 0) {
    throw new Error(`Puedes adjuntar hasta ${MAX_SUPPORT_ATTACHMENTS} documentos por reporte.`);
  }

  const slice = list.slice(0, availableSlots);
  const results: TicketAttachment[] = [];

  for (const file of slice) {
    const isImage = file.type.startsWith('image/');
    let dataUrl = '';

    if (isImage) {
      dataUrl = await compressImageFile(file);
    } else {
      if (file.size > MAX_RAW_NON_IMAGE_BYTES) {
        throw new Error(
          `El documento "${file.name}" supera el límite de 250 KB. Sube una captura de pantalla o un PDF liviano.`
        );
      }
      dataUrl = await readFileAsDataURL(file);
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        throw new Error(`El documento "${file.name}" excede el tamaño permitido.`);
      }
    }

    results.push({
      name: file.name.slice(0, 120),
      mimeType: (isImage ? 'image/jpeg' : file.type || 'application/octet-stream').slice(0, 100),
      sizeBytes: dataUrl.length,
      dataUrl,
    });
  }

  return results;
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}
