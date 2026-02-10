interface RundownNarrativeProps {
  narrative: string;
}

export default function RundownNarrative({ narrative }: RundownNarrativeProps) {
  return (
    <p className="text-base text-slate-700 leading-relaxed whitespace-pre-line">
      {narrative}
    </p>
  );
}
