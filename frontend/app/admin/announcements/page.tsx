"use client";

import { useState } from "react";
import { Button, Card, ErrorBox, Page, inputCls } from "@/components/ui";
import { useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";

export default function AdminAnnouncements() {
  const t = useT();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const send = useSend<{ sent: number }, { title: string; body: string; link: string }>("POST", "/notifications/announcements");
  return (
    <Page title={t("Gửi thông báo")}>
      <Card className="max-w-xl space-y-3">
        <p className="text-sm text-muted-foreground">{t("Thông báo sẽ hiện ở biểu tượng chuông của mọi học viên.")}</p>
        <label className="block text-sm font-medium">{t("Tiêu đề")}
          <input className={`${inputCls} mt-1`} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="block text-sm font-medium">{t("Nội dung")}
          <textarea className={`${inputCls} mt-1`} rows={3} value={body} maxLength={300} onChange={(e) => setBody(e.target.value)} /></label>
        <label className="block text-sm font-medium">{t("Liên kết (không bắt buộc, ví dụ /exams)")}
          <input className={`${inputCls} mt-1`} value={link} maxLength={200} placeholder="/exams" onChange={(e) => setLink(e.target.value)} /></label>
        {send.error && <ErrorBox error={send.error} />}
        {send.isSuccess && <p role="status" className="rounded-btn bg-success-soft px-3 py-2 text-sm font-medium text-success-text">✓ {t("Đã gửi tới {n} học viên.", { n: send.data.data.sent })}</p>}
        <Button disabled={send.isPending || !title.trim()} onClick={() => send.mutate({ title, body, link }, { onSuccess: () => { setTitle(""); setBody(""); setLink(""); } })}>{t("Gửi thông báo")}</Button>
      </Card>
    </Page>
  );
}
