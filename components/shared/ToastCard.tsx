import { Button } from "@chakra-ui/react";
import { ReactElement, ReactNode } from "react";
import { TOAST_STYLES } from "@/config/toast.config";
import { useTranslations } from "@/contexts/LocaleContext";

interface ToastCardProps {
  title: string;
  description: string;
  detail?: string;
  icon: ReactNode;
  primaryButton: {
    label: string;
    icon: ReactElement;
    onClick: () => void;
    colorScheme: string;
  };
  onClose: () => void;
  borderColor?: string;
  titleColor?: string;
}

export default function ToastCard({
  title,
  description,
  detail,
  icon,
  primaryButton,
  onClose,
  borderColor = "var(--chakra-colors-primary)",
  titleColor = "var(--chakra-colors-primary)",
}: ToastCardProps) {
  const t = useTranslations("buttons");

  return (
    <div
      style={{
        ...TOAST_STYLES.container,
        border: `1px solid ${borderColor}`,
      }}
    >
      <div style={TOAST_STYLES.content}>
        <div
          style={{
            ...TOAST_STYLES.header,
            color: titleColor,
          }}
        >
          {icon}
          {title}
        </div>
        <div style={TOAST_STYLES.description}>{description}</div>
        {detail && <div style={TOAST_STYLES.detail}>{detail}</div>}
        <div style={TOAST_STYLES.buttonContainer}>
          <Button
            size="sm"
            colorScheme={primaryButton.colorScheme}
            onClick={primaryButton.onClick}
            leftIcon={primaryButton.icon}
          >
            {primaryButton.label}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t("maybeLater")}
          </Button>
        </div>
      </div>
    </div>
  );
}
