import { open } from "@tauri-apps/plugin-dialog";
import { Button, Checkbox, Input } from "@heroui/react";
import { useConfigStore } from "../../store/configStore";

export default function CertPanel() {
  const { cert, setCert } = useConfigStore();

  const handleSelectCert = async () => {
    const selected = await open({
      filters: [{ name: "证书", extensions: ["pfx", "p12"] }],
    });
    if (selected) {
      setCert({ cert_path: selected as string });
    }
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      {/* 启用签名 */}
      <Checkbox
        isSelected={cert.enabled}
        onValueChange={(checked) => setCert({ enabled: checked })}
        size="sm"
        color="primary"
      >
        <span className="text-sm">启用签名</span>
      </Checkbox>

      {cert.enabled && (
        <>
          {/* 证书文件 */}
          <div>
            <div className="text-xs font-medium text-foreground-600 mb-1.5">证书文件 (.pfx/.p12)</div>
            <div className="flex gap-2">
              <Input
                value={cert.cert_path || ""}
                placeholder="选择证书..."
                readOnly
                size="sm"
                className="min-w-0 flex-1"
              />
              <Button size="sm" variant="flat" color="primary" onPress={handleSelectCert}>
                选择
              </Button>
            </div>
          </div>

          {/* 密码 */}
          <Input
            type="password"
            label="密码"
            value={cert.password}
            onValueChange={(val) => setCert({ password: val })}
            placeholder="输入证书密码"
            size="sm"
          />

          {/* 签名原因 */}
          <Input
            type="text"
            label="签名原因"
            value={cert.reason}
            onValueChange={(val) => setCert({ reason: val })}
            placeholder="例: 批准"
            size="sm"
          />

          {/* 签名地点 */}
          <Input
            type="text"
            label="签名地点"
            value={cert.location}
            onValueChange={(val) => setCert({ location: val })}
            placeholder="例: 公司总部"
            size="sm"
          />

          {/* 联系方式 */}
          <Input
            type="text"
            label="联系方式"
            value={cert.contact}
            onValueChange={(val) => setCert({ contact: val })}
            placeholder="邮箱或电话"
            size="sm"
          />
        </>
      )}
    </div>
  );
}
