import { VERIFICATION_STATUS_LABELS, type VerificationStatus } from "@/domain/enums";
import { Badge, type BadgeSize, type BadgeVariant } from "@/components/ui/badge";

const variants: Record<VerificationStatus, BadgeVariant> = {
  editor_verified: "success",
  machine_verified: "success",
  unverified: "warning",
  disputed: "critical",
  retracted: "critical",
};

/** Badge variant that carries the fixed meaning of each verification status. */
export function verificationBadgeVariant(status: VerificationStatus): BadgeVariant {
  return variants[status];
}

export interface VerificationLabelProps {
  status: VerificationStatus;
  size?: BadgeSize;
  className?: string;
}

/** Verification status badge: verified → success, unverified → warning, disputed/retracted → critical. */
export function VerificationLabel({ status, size = "sm", className }: VerificationLabelProps) {
  return (
    <Badge variant={verificationBadgeVariant(status)} size={size} className={className}>
      {VERIFICATION_STATUS_LABELS[status]}
    </Badge>
  );
}
