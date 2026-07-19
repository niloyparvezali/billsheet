import { useState } from "react";
import { normalizePackages } from "../utils/users";
export default function UserForm({
  form,
  setForm,
  categories,
  categoryError,
  onCategory,
  onSubmit,
}) {
  const set = (key, value) => setForm({ ...form, [key]: value });
  const selectedPackages = normalizePackages(
    form?.packages ?? form?.category ?? [],
  );
  const togglePackage = (packageName) => {
    const nextPackages = selectedPackages.includes(packageName)
      ? selectedPackages.filter((item) => item !== packageName)
      : [...selectedPackages, packageName];

    setForm((current) => ({
      ...current,
      packages: nextPackages,
      category: nextPackages[0] || "",
    }));
  };
  const handleChipClick = (event, packageName) => {
    event.preventDefault();
    event.stopPropagation();
    togglePackage(packageName);
  };
  const handleNewCategoryClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onCategory();
  };
  const filteredCategories = categories;
  const phoneInputValue = String(form.phone || "").startsWith("+880")
    ? String(form.phone || "").slice(4)
    : String(form.phone || "").replace(/^\+/, "");
  const updatePhoneValue = (rawValue) => {
    const digits = String(rawValue || "")
      .replace(/\D/g, "")
      .slice(0, 11);
    set("phone", digits ? `+880${digits}` : "");
  };
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
      <label
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        Package / Category
        <div
          className="row row--stacked"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <div className="package-chip-list">
            {filteredCategories.map((category) => {
              const checked = selectedPackages.includes(category.name);
              return (
                <button
                  key={category.id}
                  type="button"
                  className={`package-chip${checked ? " package-chip--active" : ""}`}
                  onClick={(event) => handleChipClick(event, category.name)}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
          <div className="package-add-btn">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleNewCategoryClick}
            >
              + New
            </button>
          </div>
        </div>
        {categoryError && (
          <small className="field-error">
            Categories could not load:{" "}
            {categoryError.code || categoryError.message}
          </small>
        )}
      </label>
      <label>
        Monthly Bill
        <input
          type="number"
          required
          min="0"
          step="any"
          placeholder="Amount"
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
        Status
        <select
          value={form.status || "Active"}
          onChange={(e) => set("status", e.target.value)}
          className={`user-status-select ${String(form.status || "Active").toLowerCase()}`}
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
          placeholder="+880123456789"
          value={phoneInputValue}
          onChange={(event) => updatePhoneValue(event.target.value)}
        />
      </label>
      <label>
        Description
        <textarea
          value={form.address || ""}
          onChange={(e) => set("address", e.target.value)}
        />
      </label>
      <button className="btn btn-primary">Save user</button>
    </form>
  );
}
