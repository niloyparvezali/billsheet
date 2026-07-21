import { FiEdit2, FiPlus, FiSearch, FiTrash2, FiUsers } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import UsersTable from "../components/UsersTable";
import CategoryModal from "../components/CategoryModal";
import UserForm from "../components/UserForm";
import PaymentModal from "../components/PaymentModal";
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
import { useLanguage } from "../context/LanguageContext";
import useOwnedCollection from "../hooks/useOwnedCollection";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import { formatDate, money } from "../utils/date";
import { getDisplayPackages, normalizeBangladeshPhone, normalizePackages } from "../utils/users";

const todayValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const blank = {
  name: "",
  category: "",
  packages: [],
  monthlyBill: "",
  phone: "",
  address: "",
  joinDate: todayValue(),
  status: "Active",
  statusHistory: [],
};

export default function Users() {
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const { user: signedInUser } = useAuth();
  const { t, formatNumber } = useLanguage();
  const { data: allUsers = [] } = useOwnedCollection("users");
  const users = useMemo(() => (allUsers || []).filter(Boolean), [allUsers]);
  const { data: savedCategories, error: categoryError } =
    useOwnedCollection("categories");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [category, setCategory] = useState(false);
  const [formError, setFormError] = useState("");
  const [newCategories, setNewCategories] = useState([]);
  const [deleteUser, setDeleteUser] = useState(null);
  const [categoryToRemove, setCategoryToRemove] = useState(null);
  const [paymentModalUser, setPaymentModalUser] = useState(null);
  const categories = useMemo(() => {
    const seenIds = new Set((savedCategories || []).map((item) => item.id));
    const merged = [
      ...(savedCategories || []),
      ...newCategories.filter((newItem) => !seenIds.has(newItem.id)),
    ];
    const selectedPackages = normalizePackages(form?.packages || form?.category || []);
    selectedPackages.forEach((packageName) => {
      if (
        packageName &&
        !merged.some(
          (item) => item.name?.trim().toLowerCase() === packageName.toLowerCase(),
        )
      ) {
        merged.push({ id: `current-${packageName}`, name: packageName });
      }
    });
    return merged
      .filter((item) => item.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [savedCategories, newCategories, form?.packages, form?.category]);
  const list = useMemo(
    () =>
      users
        .filter((user) => {
          const displayPackages = getDisplayPackages(user).join(" ");
          return [user.name, user.category, displayPackages, user.phone].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(search.toLowerCase()),
          );
        })
        .sort((a, b) => {
          const aActive = String(a?.status || (a?.active === false ? "Inactive" : "Active")).trim().toLowerCase() !== "inactive";
          const bActive = String(b?.status || (b?.active === false ? "Inactive" : "Active")).trim().toLowerCase() !== "inactive";
          if (aActive !== bActive) return aActive ? -1 : 1;
          return (a?.name || "").localeCompare(b?.name || "");
        }),
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
    const normalizedPhone = normalizeBangladeshPhone(form.phone || "");
    if (form.phone && !/^\+8801[3-9]\d{8}$/.test(normalizedPhone)) {
      toast.error("Enter a valid Bangladesh phone number beginning with +880");
      return;
    }
    if (!form.id && !signedInUser) {
      toast.error("Please sign in again before adding a user");
      return;
    }
    try {
      const normalizedStatus = String(form.status || "Active").trim();
      const normalizedStatusValue = normalizedStatus === "Inactive" ? "Inactive" : "Active";
      const isActive = normalizedStatusValue !== "Inactive";
      const previousStatus = String(form?.status || (form?.active === false ? "Inactive" : "Active")).trim().toLowerCase();
      const nextStatus = normalizedStatusValue.toLowerCase();
      const historyEntries = Array.isArray(form?.statusHistory) ? form.statusHistory : [];
      const statusChanged = previousStatus && previousStatus !== nextStatus;
      const nextHistory = statusChanged
        ? [...historyEntries, { status: normalizedStatusValue, date: new Date().toISOString() }]
        : historyEntries;
      const selectedPackages = normalizePackages(form?.packages || form?.category || []);
      const data = {
        name: form.name.trim(),
        category: selectedPackages[0] || form.category || "",
        packages: selectedPackages,
        monthlyBill: Number(form.monthlyBill || 0),
        phone: normalizedPhone,
        address: form.address.trim(),
        joinDate: form.joinDate || todayValue(),
        inactiveDate: isActive ? null : serverTimestamp(),
        status: normalizedStatusValue,
        active: isActive,
        statusHistory: nextHistory,
        ...(form.id
          ? {}
          : {
              ownerId: signedInUser.uid,
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
      setFormError("");
    } catch (error) {
      setFormError(error.message || "Could not save user");
      toast.error(error.message || "Could not save user");
    }
  };
  const remove = async (id) => {
    try {
      const existingUser = (allUsers || []).find((item) => item.id === id);
      const historyEntries = Array.isArray(existingUser?.statusHistory) ? existingUser.statusHistory : [];
      await updateDoc(doc(db, "users", id), {
        active: false,
        status: "Inactive",
        inactiveDate: serverTimestamp(),
        disconnectedAt: serverTimestamp(),
        statusHistory: [...historyEntries, { status: "Inactive", date: new Date().toISOString() }],
      });
      toast.success("User deactivated; payment history kept");
    } catch (error) {
      toast.error(error.message || "Could not deactivate user");
    } finally {
      setDeleteUser(null);
    }
  };

  const openAddPayment = (user) => {
    if (!user) return;
    navigate("/monthly-sheet", {
      state: {
        selectedCustomerId: user.id,
        selectedCustomerName: user.name,
      },
    });
  };

  const openPaymentHistory = (user) => {
    if (!user) return;
    navigate("/history", {
      state: {
        selectedCustomerId: user.id,
        selectedCustomerName: user.name,
      },
    });
  };

  const openAnnualReport = (user) => {
    if (!user) return;
    navigate("/reports", {
      state: {
        customerId: user.id,
        customerName: user.name,
      },
    });
  };

  const removeCategory = async (category) => {
    if (!category?.id) {
      toast.error("Could not delete category because its ID is missing.");
      setCategoryToRemove(null);
      return;
    }

    const inUse = allUsers.some((user) => {
      const packages = getDisplayPackages(user);
      return packages.some(
        (packageName) =>
          packageName.trim().toLowerCase() === category.name.trim().toLowerCase(),
      );
    });
    if (inUse) {
      toast.error(
        "This category is currently assigned to one or more users and cannot be deleted.",
      );
      setCategoryToRemove(null);
      return;
    }

    const optimisticRemoval = {
      id: category.id,
      name: category.name,
    };
    setNewCategories((current) =>
      current.filter((item) => item.id !== category.id),
    );
    setCategoryToRemove(null);

    try {
      await deleteDoc(doc(db, "categories", category.id));
      toast.success("Category deleted successfully.");
    } catch (error) {
      setNewCategories((current) => {
        const alreadyPresent = current.some((item) => item.id === optimisticRemoval.id);
        if (alreadyPresent) return current;
        return [...current, optimisticRemoval];
      });
      toast.error(`Could not delete category: ${error.message}`);
    }
  };

  return (
    <div className="page users-page">
      <section className="panel users-panel">
        <div className="users-page-header">
          <div className="users-page-heading">
            <h1>{t("users")}</h1>
            <p>{t("manage_users_subtitle", "Manage customers and account information.")}</p>
          </div>
        </div>
        <div className="users-toolbar">
          <div className="users-toolbar-left">
            <label className="search users-search">
              <FiSearch />
              <input
                ref={searchRef}
                placeholder={t("search_users_placeholder", "Search users by name, category or phone...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="users-meta">
              <FiUsers />
              <span> {t("total_users")}:</span>
              <strong>{formatNumber(list.length)}</strong>
            </div>
          </div>
          <button
            className="btn btn-primary users-add-btn"
            onClick={() => setForm(blank)}
          >
            <FiPlus /> {t("add_user")}
          </button>
        </div>
        <UsersTable
          list={paginatedUsers}
          setForm={setForm}
          setDeleteUser={setDeleteUser}
          onAddPayment={openAddPayment}
          onViewHistory={openPaymentHistory}
          onViewAnnualReport={openAnnualReport}
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
          title={form.id ? t("edit_user") : t("add_user")}
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
      {paymentModalUser && (
        <PaymentModal
          data={{ user: paymentModalUser }}
          month={new Date().getMonth() + 1}
          year={new Date().getFullYear()}
          ownerId={signedInUser?.uid || ""}
          close={() => setPaymentModalUser(null)}
        />
      )}
      {category && (
        <CategoryModal
          ownerId={signedInUser.uid}
          categories={categories}
          users={users}
          close={() => setCategory(false)}
          onAdded={(item) => {
            setNewCategories((current) => [...current, item]);
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
          title={t("delete_user", "Delete user")}
          message={`${t("delete_confirm", "Delete")} ${deleteUser.name}? ${t("payment_records_kept", "Their past payment records will be kept.")}`}
          confirmText={t("delete", "Delete")}
          cancelText={t("cancel", "Cancel")}
          onConfirm={() => remove(deleteUser.id)}
          onCancel={() => setDeleteUser(null)}
        />
      )}
      {categoryToRemove && (
        <ConfirmModal
          title={t("delete_category", "Delete category")}
          message={t("delete_category_confirm", "Are you sure you want to delete this category?")}
          confirmText={t("delete", "Delete")}
          cancelText={t("cancel", "Cancel")}
          onConfirm={() => removeCategory(categoryToRemove)}
          onCancel={() => setCategoryToRemove(null)}
        />
      )}
    </div>
  );
}
