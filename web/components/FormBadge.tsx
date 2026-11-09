import { FORM_DESCRIPTIONS } from "@/lib/format";

const FormBadge = ({ form }: { form: string }) => {
  return (
    <span
      title={FORM_DESCRIPTIONS[form]}
      className="inline-block rounded border border-line bg-paper px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-ink-2"
    >
      {form}
    </span>
  );
};

export default FormBadge;
