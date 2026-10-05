import { readPreview } from './raster.js';

let currentController = null;
self.onmessage = async ({ data }) => {
  if (data.type === 'cancel') {
    currentController?.abort();
    return;
  }
  currentController?.abort();
  const controller = new AbortController();
  currentController = controller;
  try {
    const preview = await readPreview({ ...data.request, signal: controller.signal,
      onProgress: (message) => self.postMessage({ type: 'progress', id: data.id, message }) });
    if (!controller.signal.aborted) self.postMessage({ type: 'result', id: data.id, preview }, [preview.values.buffer]);
  } catch (error) {
    self.postMessage({ type: controller.signal.aborted ? 'cancelled' : 'error', id: data.id, message: error.message });
  } finally {
    if (currentController === controller) currentController = null;
  }
};