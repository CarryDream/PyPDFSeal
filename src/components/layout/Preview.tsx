import { useConfigStore } from "../../store/configStore";
import PdfViewer from "../preview/PdfViewer";

export default function Preview() {
  const { files, selectedPageIndex } = useConfigStore();
  const currentFile = files[selectedPageIndex] ?? files[0] ?? null;

  return (
    <div className="preview-container">
      {currentFile ? (
        <PdfViewer filePath={currentFile} />
      ) : (
        <div className="preview-empty">请添加 PDF 文件</div>
      )}
    </div>
  );
}
