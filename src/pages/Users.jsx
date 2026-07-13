import { useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { FiEdit2, FiPlus, FiSearch, FiTrash2, FiUsers } from "react-icons/fi";
import toast from "react-hot-toast";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import useOwnedCollection from "../hooks/useOwnedCollection";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import { formatDate, money } from "../utils/date";

const blank = {
  name: "",
  category: "",
  monthlyBill: "",
  phone: "",
  address: "",
};

export default function Users() {
  const { user: signedInUser } = useAuth();
  const { data: allUsers } = useOwnedCollection("users");
  const users = useMemo(
    () => allUsers.filter((user) => user.active !== false),
    [allUsers],
  );
  const { data: savedCategories, error: categoryError } =
    useOwnedCollection("categories");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [category, setCategory] = useState(false);
  const [newCategories, setNewCategories] = useState([]);
  const [deleteUser, setDeleteUser] = useState(null);
  const [categoryToRemove, setCategoryToRemove] = useState(null);
  const categories = useMemo(() => {
    const seenIds = new Set(savedCategories.map((item) => item.id));
    const merged = [
      ...savedCategories,
      ...newCategories.filter((newItem) => !seenIds.has(newItem.id)),
    ];
    const currentCategory = form?.category?.trim();
    if (
      currentCategory &&
      !merged.some(
        (item) =>
          item.name?.trim().toLowerCase() === currentCategory.toLowerCase(),
      )
    ) {
      merged.push({ id: `current-${currentCategory}`, name: currentCategory });
    }
    return merged
      .filter((item) => item.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [savedCategories, newCategories, form?.category]);
  const list = useMemo(
    () =>
      users
        .filter((user) =>
          [user.name, user.category, user.phone].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(search.toLowerCase()),
          ),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users, search],
  );
  const save = async (event) => {
    event.preventDefault();
    if (!form?.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.id && !signedInUser) {
      toast.error("Please sign in again before adding a user");
      return;
    }
    try {
      const data = {
        name: form.name.trim(),
        category: form.category,
        monthlyBill: Number(form.monthlyBill || 0),
        phone: form.phone.trim(),
        address: form.address.trim(),
        ...(form.id
          ? {}
          : {
              ownerId: signedInUser.uid,
              active: true,
              createdAt: serverTimestamp(),
            }),
      };
      if (form.id)
        await updateDoc(doc(db, "users", form.id), {
          ...data,
          updatedAt: serverTimestamp(),
        });
      else await addDoc(collection(db, "users"), data);
      toast.success("User saved");
      setForm(null);
    } catch (error) {
      toast.error(error.message);
    }
  };
  const remove = async (id) => {
    try {
      await updateDoc(doc(db, "users", id), {
        active: false,
        disconnectedAt: serverTimestamp(),
      });
      toast.success("User deleted; payment history kept");
    } catch (error) {
      toast.error(error.message || "Could not delete user");
    } finally {
      setDeleteUser(null);
    }
  };

  const removeCategory = async (category) => {
    const inUse = allUsers.some(
      (user) =>
        user.category?.trim().toLowerCase() ===
        category.name.trim().toLowerCase(),
    );
    if (inUse) {
      toast.error("This category is used by a customer and cannot be removed");
      return;
    }
    try {
      await deleteDoc(doc(db, "categories", category.id));
      setNewCategories((current) =>
        current.filter((item) => item.id !== category.id),
      );
      toast.success(`${category.name} category removed`);
    } catch (error) {
      toast.error(`Could not remove category: ${error.message}`);
    } finally {
      setCategoryToRemove(null);
    }
  };

  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h2>Users</h2>
        </div>
      </div>
      <section className="panel users-panel">
        <div className="users-toolbar">
          <div className="users-toolbar-left">
            <label className="search users-search">
              <FiSearch />
              <input
                placeholder="Search users by name, category or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="users-meta">
              <FiUsers />
              <span> Total Users:</span>
              <strong>{String(list.length).padStart(2, "0")}</strong>
            </div>
          </div>

          <button
            className="btn btn-primary users-add-btn"
            onClick={() => setForm(blank)}
          >
            <FiPlus /> Add user
          </button>
        </div>

        <div className="table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>SL</th>
                <th>Name</th>
                <th>Category</th>
                <th>Monthly Bill</th>
                <th>Phone</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((user, i) => (
                <tr key={user.id}>
                  <td data-label="SL">{i + 1}</td>
                  <td data-label="Name">
                    <b>{user.name}</b>
                  </td>
                  <td data-label="Category">
                    <span className="tag">{user.category}</span>
                  </td>
                  <td data-label="Monthly Bill">{money(user.monthlyBill)}</td>
                  <td data-label="Phone">{user.phone || "—"}</td>
                  <td data-label="Created">{formatDate(user.createdAt)}</td>
                  <td className="actions" data-label="Action">
                    <button onClick={() => setForm(user)}>
                      <FiEdit2 />
                    </button>
                    <button
                      className="danger"
                      onClick={() => setDeleteUser(user)}
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <p className="empty">No users match your search.</p>}
        </div>
      </section>
      {form && (
        <Modal
          title={form.id ? "Edit user" : "Add user"}
          onClose={() => setForm(null)}
        >
          <UserForm
            form={form}
            setForm={setForm}
            categories={categories}
            categoryError={categoryError}
            onCategory={() => setCategory(true)}
            onSubmit={save}
          />
        </Modal>
      )}
      {category && (
        <CategoryModal
          ownerId={signedInUser.uid}
          categories={categories}
          users={users}
          close={() => setCategory(false)}
          onAdded={(item) => {
            setNewCategories((current) => [...current, item]);
            setForm((current) => ({ ...current, category: item.name }));
          }}
          onRemoved={(id) =>
            setNewCategories((current) =>
              current.filter((item) => item.id !== id),
            )
          }
          requestRemoveCategory={setCategoryToRemove}
        />
      )}
      {deleteUser && (
        <ConfirmModal
          title="Delete user"
          message={`Delete ${deleteUser.name}? Their past payment records will be kept.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => remove(deleteUser.id)}
          onCancel={() => setDeleteUser(null)}
        />
      )}
      {categoryToRemove && (
        <ConfirmModal
          title="Remove category"
          message={`Remove the category “${categoryToRemove.name}”? This cannot be undone.`}
          confirmText="Remove"
          cancelText="Cancel"
          onConfirm={() => removeCategory(categoryToRemove)}
          onCancel={() => setCategoryToRemove(null)}
        />
      )}
    </div>
  );
}

function UserForm({
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

function CategoryModal({
  ownerId,
  categories,
  users,
  close,
  onAdded,
  onRemoved,
  requestRemoveCategory,
}) {
  const [name, setName] = useState("");
  const save = async (event) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    if (
      categories.some(
        (category) =>
          category.name.trim().toLowerCase() === clean.toLowerCase(),
      )
    ) {
      toast.error(`The category “${clean}” already exists`);
      return;
    }
    try {
      const added = await addDoc(collection(db, "categories"), {
        ownerId,
        name: clean,
        createdAt: serverTimestamp(),
      });
      onAdded({ id: added.id, name: clean });
      toast.success(`${clean} category added`);
      setName("");
    } catch (error) {
      toast.error(`Could not add category: ${error.message}`);
    }
  };
  return (
    <Modal title="Manage categories" onClose={close}>
      <form className="form" onSubmit={save}>
        <label>
          New category name
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="btn btn-primary">Save category</button>
      </form>
      {categories.length > 0 && (
        <div className="category-list">
          {categories.map((category) => {
            const inUse = users.some(
              (user) =>
                user.category?.trim().toLowerCase() ===
                category.name.trim().toLowerCase(),
            );
            return (
              <div className="activity" key={category.id}>
                <b>{category.name}</b>
                <div className="actions">
                  <button
                    className="danger"
                    type="button"
                    title={
                      inUse ? "This category is in use" : "Remove category"
                    }
                    disabled={inUse}
                    onClick={() => requestRemoveCategory(category)}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
