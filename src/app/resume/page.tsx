import { ResumeEditor } from "@/components/ResumeEditor";
import { ResumeEditorStatic } from "@/components/ResumeEditorStatic";

export default function ResumePage() {
  return process.env.PAGES_EXPORT === "1" ? <ResumeEditorStatic /> : <ResumeEditor />;
}
