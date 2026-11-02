import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { MIN_PASSWORD_LENGTH } from "../account/emailAuth";
import { Button } from "./Button";

export function PasswordField({ label, value, onChange, disabled, creating = false }: {
  label: string; value: string; onChange: (value: string) => void; disabled: boolean; creating?: boolean;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <>
    <label htmlFor={id}>{label}</label>
    <div className="account-dialog__password">
      <input id={id} type={visible ? "text" : "password"} autoComplete={creating ? "new-password" : "current-password"}
        minLength={creating ? MIN_PASSWORD_LENGTH : undefined} required value={value} disabled={disabled} onChange={event => onChange(event.target.value)} />
      <Button className="account-dialog__password-toggle" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible} disabled={disabled} onClick={() => setVisible(value => !value)}>
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </Button>
    </div>
  </>;
}
