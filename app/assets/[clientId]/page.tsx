export default function AssetRegisterPage() {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Asset Register</h2>
          <p className="text-sm text-slate-500">
            Current fixed assets for this client.
          </p>
        </div>

        <button
          type="button"
          className="border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          + Add Asset
        </button>
      </div>

      <div className="overflow-hidden border border-slate-300 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-100 text-left">
            <tr className="border-b border-slate-300">
              <th className="px-3 py-2 font-semibold">Asset No.</th>
              <th className="px-3 py-2 font-semibold">Description</th>
              <th className="px-3 py-2 font-semibold">Class</th>
              <th className="px-3 py-2 font-semibold">Acquisition Date</th>
              <th className="px-3 py-2 text-right font-semibold">Cost</th>
              <th className="px-3 py-2 text-right font-semibold">Accum. Dep.</th>
              <th className="px-3 py-2 text-right font-semibold">Carrying Amount</th>
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                No assets captured yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
