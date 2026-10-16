import { Stat } from 'panelui-web/stat';

/** One reading at each size, largest first. */
const READINGS = [
  { size: 'lg', label: 'Orders today', value: '1,284' },
  { size: 'md', label: 'Average basket', value: '42.10', unit: 'EUR' },
  { size: 'sm', label: 'Returns', value: '2.4', unit: '%' },
] as const;

export default function StatSizes() {
  return (
    <div className="flex flex-wrap items-end justify-center gap-10">
      {READINGS.map((reading) => (
        <Stat.Content key={reading.label}>
          <Stat.Label>{reading.label}</Stat.Label>
          <Stat.Value size={reading.size}>
            {reading.value}
            {'unit' in reading ? <Stat.Unit>{reading.unit}</Stat.Unit> : null}
          </Stat.Value>
        </Stat.Content>
      ))}
    </div>
  );
}
