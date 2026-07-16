import { FiPlus } from "react-icons/fi";
export default function UserForm({
  form,
  setForm,
  categories,
  categoryError,
  onCategory,
  onSubmit,
}) {
  const set = (key, value) => setForm({ ...form, [key]: value });
  return (
    <form onSubmit={onSubmit} className="form">
      <label>
        Name
        <input
          required
          value={form.name || ""}
          onChange={(e) => set("name", e.target.value)}
        />
      </label>
      <label>
        Category
        <div className="row">
          <select
            required
            value={form.category || ""}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCategory}
          >
            + New
          </button>
        </div>
        {categoryError && (
          <small className="field-error">
            Categories could not load:{" "}
            {categoryError.code || categoryError.message}
          </small>
        )}
      </label>
      <label>
        Monthly bill
        <input
          type="number"
          min="0"
          step="any"
          placeholder="e.g. 500"
          value={form.monthlyBill ?? ""}
          onChange={(e) => set("monthlyBill", e.target.value)}
        />
      </label>
      <label>
        Join date
        <input
          type="date"
          value={form.joinDate || ""}
          onChange={(e) => set("joinDate", e.target.value)}
        />
      </label>
      <label>
        Leave date
        <input
          type="date"
          value={form.leaveDate || ""}
          onChange={(e) => set("leaveDate", e.target.value)}
        />
      </label>
      <label>
        Status
        <select
          value={form.status || "Active"}
          onChange={(e) => set("status", e.target.value)}
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </label>
      <label>
        Phone number
        <input
          type="tel"
          inputMode="tel"
          placeholder="e.g. +8801XXXXXXXXX"
          value={form.phone || ""}
          onChange={(e) => set("phone", e.target.value)}
        />
      </label>
      <label>
        Address
        <textarea
          value={form.address || ""}
          onChange={(e) => set("address", e.target.value)}
        />
      </label>
      <button className="btn btn-primary">Save user</button>
    </form>
  );
}
