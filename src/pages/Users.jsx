import { FiEdit2, FiPlus, FiSearch, FiTrash2, FiUsers } from "react-icons/fi";
import UsersTable from "../components/UsersTable";
import CategoryModal from "../components/CategoryModal";
import UserForm from "../components/UserForm";
import { useMemo, useState, useRef, useEffect } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
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
  joinDate: "",
  leaveDate: "",
  status: "Active",
};

export default function Users() {
  const searchRef = useRef(null);
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
  const USERS_PER_PAGE = 50;

  const [currentPage, setCurrentPage] = useState(1);
  const totalUsers = list.length;

  const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PER_PAGE));

  const startIndex = (currentPage - 1) * USERS_PER_PAGE;

  const endIndex = Math.min(startIndex + USERS_PER_PAGE, totalUsers);

  const paginatedUsers = list.slice(startIndex, endIndex);
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);
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
        joinDate: form.joinDate || null,
        leaveDate: form.leaveDate || null,
        status: form.status || "Active",
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
        status: "Inactive",
        leaveDate: new Date().toISOString(),
        disconnectedAt: serverTimestamp(),
      });
      toast.success("User deactivated; payment history kept");
    } catch (error) {
      toast.error(error.message || "Could not deactivate user");
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
      <section className="panel users-panel">
        <div className="users-toolbar">
          <div className="users-toolbar-left">
            <label className="search users-search">
              <FiSearch />
              <input
                ref={searchRef}
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
        <UsersTable
          list={paginatedUsers}
          setForm={setForm}
          setDeleteUser={setDeleteUser}
          money={money}
          formatDate={formatDate}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
          totalUsers={totalUsers}
          startIndex={startIndex}
          endIndex={endIndex}
        />
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
