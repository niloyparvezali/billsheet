import {
  FiPlus,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import UsersTable from "../components/UsersTable";
import CategoryModal from "../components/CategoryModal";
import UserForm from "../components/UserForm";
import PaymentModal from "../components/PaymentModal";
import FloatingSearch from "../components/FloatingSearch";
import { useMemo, useState, useRef, useEffect } from "react";
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { auth, db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import useOwnedCollection from "../hooks/useOwnedCollection";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import {
  buildUserDocId,
  findDuplicateUser,
  getDisplayPackages,
  normalizeBangladeshPhone,
  normalizePackages,
} from "../utils/users";
import { getNextCustomerId } from "../utils/customerId";
import { buildMonthlyBillHistoryEntry, getPaymentMonthYear } from "../utils/payments";
import { buildUpdatedMembershipHistory } from "../utils/membership";
import { getCurrentUserBalance } from "../utils/userHistory";
import UserProfile from "../components/UserProfile";

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
  const currentOwnerId = auth?.currentUser?.uid || signedInUser?.uid || null;
  const { t, formatNumber } = useLanguage();
  const { data: allUsers = [] } = useOwnedCollection("users");
  const { data: payments = [], loading: paymentsLoading = true } = useOwnedCollection("payments");
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
    const selectedPackages = normalizePackages(
      form?.packages || form?.category || [],
    );
    selectedPackages.forEach((packageName) => {
      if (
        packageName &&
        !merged.some(
          (item) =>
            item.name?.trim().toLowerCase() === packageName.toLowerCase(),
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
          return [user.name, user.category, displayPackages, user.phone].some(
            (value) =>
              String(value || "")
                .toLowerCase()
                .includes(search.toLowerCase()),
          );
        })
        .sort((a, b) => {
          const aActive =
            String(a?.status || (a?.active === false ? "Inactive" : "Active"))
              .trim()
              .toLowerCase() !== "inactive";
          const bActive =
            String(b?.status || (b?.active === false ? "Inactive" : "Active"))
              .trim()
              .toLowerCase() !== "inactive";
          if (aActive !== bActive) return aActive ? -1 : 1;
          return (a?.name || "").localeCompare(b?.name || "");
        }),
    [users, search],
  );
  const USERS_PER_PAGE = 50;

  const [currentPage, setCurrentPage] = useState(1);
  const totalUsers = list.length;
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [mobileView, setMobileView] = useState("list");
  const [savedScrollTop, setSavedScrollTop] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [balanceDate, setBalanceDate] = useState(() => new Date());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let timerId;
    const scheduleNextMonthRefresh = () => {
      const now = new Date();
      const nextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
        0,
        0,
        1,
      );
      const delay = Math.max(1000, nextMonth.getTime() - now.getTime());
      timerId = window.setTimeout(() => {
        setBalanceDate(new Date());
        scheduleNextMonthRefresh();
      }, delay);
    };

    scheduleNextMonthRefresh();
    return () => window.clearTimeout(timerId);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalUsers / USERS_PER_PAGE));

  const startIndex = (currentPage - 1) * USERS_PER_PAGE;

  const endIndex = Math.min(startIndex + USERS_PER_PAGE, totalUsers);

  const paginatedUsers = list.slice(startIndex, endIndex);

  const userBalanceById = useMemo(() => {
    const balanceMap = new Map();
    (paginatedUsers || []).forEach((user) => {
      if (!user?.id) return;
      const summary = getCurrentUserBalance(user, payments, balanceDate);
      balanceMap.set(user.id, summary);
    });
    return balanceMap;
  }, [paginatedUsers, payments, balanceDate]);
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateIsMobile = () => setIsMobile(window.innerWidth < 1024);
    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    const stillVisible = list.some((user) => user.id === selectedUserId);
    if (!stillVisible) {
      setSelectedUserId(null);
      setMobileView("list");
    }
  }, [list, selectedUserId]);

  const selectedUser = useMemo(
    () => list.find((user) => user.id === selectedUserId) || null,
    [list, selectedUserId],
  );

  const showStandaloneMobileDetail =
    isMobile && mobileView === "detail" && Boolean(selectedUser);
  const showDesktopDetail = !isMobile && mobileView === "detail" && Boolean(selectedUser);

  const openUserDetails = (userId) => {
    setSelectedUserId(userId);
    setSavedScrollTop(window.scrollY || 0);
    setMobileView("detail");
    if (isMobile) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  };

  const closeUserDetails = () => {
    setMobileView("list");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollTop, left: 0, behavior: "auto" });
    });
  };

  const getUserStatusValue = (user) => {
    const rawStatus = user?.status;
    const statusValue = String(
      rawStatus !== undefined && rawStatus !== null
        ? rawStatus
        : user?.active === false
        ? "Inactive"
        : "Active",
    )
      .trim()
      .toLowerCase();

    if (["n/a", "na", "none", "not joined"].includes(statusValue)) {
      return "Inactive";
    }

    return statusValue === "inactive" ? "Inactive" : "Active";
  };

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
    if (!form.id && !currentOwnerId) {
      toast.error("Please sign in again before adding a user");
      return;
    }
    try {
      const normalizedStatus = String(form.status || "Active").trim();
      const normalizedStatusValue =
        normalizedStatus === "Inactive" ? "Inactive" : "Active";
      const isActive = normalizedStatusValue !== "Inactive";
      const previousStatus = String(
        form?.status || (form?.active === false ? "Inactive" : "Active"),
      )
        .trim()
        .toLowerCase();
      const nextStatus = normalizedStatusValue.toLowerCase();
      const historyEntries = Array.isArray(form?.statusHistory)
        ? form.statusHistory
        : [];
      const statusChanged = previousStatus && previousStatus !== nextStatus;
      const nextHistory = statusChanged
        ? [
            ...historyEntries,
            { status: normalizedStatusValue, date: new Date().toISOString() },
          ]
        : historyEntries;

      const joinDateValue = form.joinDate || todayValue();
      const joinDateParsed = new Date(joinDateValue);
      if (!joinDateValue || Number.isNaN(joinDateParsed.getTime())) {
        toast.error("Join date is required and must be valid");
        return;
      }
      const now = new Date();
      const todayString = `${now.getFullYear()}-${String(
        now.getMonth() + 1,
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (joinDateValue > todayString) {
        toast.error("Join date cannot be in the future");
        return;
      }

      const selectedPackages = normalizePackages(
        form?.packages || form?.category || [],
      );
      const nextMonthlyBill = Number(form.monthlyBill || 0);
      const existingUser = form.id
        ? (allUsers || []).find((item) => item.id === form.id) || form
        : null;
      const previousMonthlyBill = Number(existingUser?.monthlyBill || 0);
      const existingBillHistory = Array.isArray(existingUser?.billHistory)
        ? existingUser.billHistory
        : [];

      const runningMonth = now.getMonth() + 1;
      const runningYear = now.getFullYear();

      let nextBillHistory = existingBillHistory;

      if (!form.id) {
        nextBillHistory = [
          {
            effectiveYear: joinDateParsed.getFullYear(),
            effectiveMonth: joinDateParsed.getMonth() + 1,
            monthlyBill: nextMonthlyBill,
          },
        ];
      } else if (
        nextMonthlyBill !== previousMonthlyBill ||
        existingBillHistory.length === 0
      ) {
        // Legacy users may not have billHistory yet. Reconstruct the known
        // historical rates from payment snapshots, then lock the current
        // running month to the newly saved rate. Transactions themselves are
        // never modified.
        const historyByPeriod = new Map();
        existingBillHistory.forEach((entry) => {
          const entryMonth = Number(entry?.effectiveMonth ?? entry?.month);
          const entryYear = Number(entry?.effectiveYear ?? entry?.year);
          const entryBill = Number(
            entry?.monthlyBill ?? entry?.bill ?? entry?.amount ?? 0,
          );
          if (entryMonth >= 1 && entryMonth <= 12 && Number.isFinite(entryYear)) {
            historyByPeriod.set(
              `${entryYear}-${String(entryMonth).padStart(2, "0")}`,
              {
                effectiveYear: entryYear,
                effectiveMonth: entryMonth,
                monthlyBill: entryBill,
              },
            );
          }
        });

        const userPayments = (payments || []).filter(
          (payment) =>
            payment?.userId === existingUser?.id ||
            payment?.customerId === existingUser?.customerId,
        );
        userPayments.forEach((payment) => {
          const paymentBill = Number(
            payment?.monthlyBill ?? payment?.billAmount ?? payment?.bill ?? NaN,
          );
          if (!Number.isFinite(paymentBill)) return;
          const paymentPeriod = getPaymentMonthYear(payment);
          if (!paymentPeriod?.month || !paymentPeriod?.year) return;
          const key = `${paymentPeriod.year}-${String(paymentPeriod.month).padStart(2, "0")}`;
          if (!historyByPeriod.has(key)) {
            historyByPeriod.set(key, {
              effectiveYear: Number(paymentPeriod.year),
              effectiveMonth: Number(paymentPeriod.month),
              monthlyBill: paymentBill,
            });
          }
        });

        const joinPeriod =
          joinDateParsed.getFullYear() * 100 + (joinDateParsed.getMonth() + 1);
        const currentPeriod = runningYear * 100 + runningMonth;
        const sortedKnownHistory = [...historyByPeriod.values()].sort((a, b) => {
          const aKey = a.effectiveYear * 100 + a.effectiveMonth;
          const bKey = b.effectiveYear * 100 + b.effectiveMonth;
          return aKey - bKey;
        });

        let carriedBill =
          sortedKnownHistory[0]?.monthlyBill ?? previousMonthlyBill;
        for (let cursor = joinPeriod; cursor <= currentPeriod; ) {
          const cursorYear = Math.floor(cursor / 100);
          const cursorMonth = cursor % 100;
          const key = `${cursorYear}-${String(cursorMonth).padStart(2, "0")}`;
          if (historyByPeriod.has(key)) {
            carriedBill = historyByPeriod.get(key).monthlyBill;
          } else if (cursor < currentPeriod) {
            historyByPeriod.set(key, {
              effectiveYear: cursorYear,
              effectiveMonth: cursorMonth,
              monthlyBill: carriedBill,
            });
          }
          cursor =
            cursorMonth === 12
              ? (cursorYear + 1) * 100 + 1
              : cursorYear * 100 + (cursorMonth + 1);
        }

        nextBillHistory = buildMonthlyBillHistoryEntry({
          existingHistory: [...historyByPeriod.values()],
          effectiveMonth: runningMonth,
          effectiveYear: runningYear,
          newMonthlyBill: nextMonthlyBill,
        });
      }

      const membershipHistory = buildUpdatedMembershipHistory({
        user: existingUser,
        nextStatus: normalizedStatusValue,
        joinDate: joinDateValue,
        now,
      });

      const latestMembership =
        membershipHistory[membershipHistory.length - 1] || null;

      const effectiveJoinDate =
        statusChanged &&
        previousStatus === "inactive" &&
        isActive
          ? latestMembership?.joinDate || joinDateValue
          : joinDateValue;

      const data = {
        name: form.name.trim(),
        category: selectedPackages[0] || form.category || "",
        packages: selectedPackages,
        monthlyBill: nextMonthlyBill,
        billHistory: nextBillHistory,
        phone: normalizedPhone,
        address: form.address.trim(),
        joinDate: effectiveJoinDate,
        inactiveDate: isActive
          ? null
          : statusChanged
            ? serverTimestamp()
            : existingUser?.inactiveDate || null,
        membershipHistory,
        status: normalizedStatusValue,
        active: isActive,
        statusHistory: nextHistory,
      };
      if (form.id) {
        await updateDoc(doc(db, "users", form.id), {
          ...data,
          updatedAt: serverTimestamp(),
        });
      } else {
        const duplicateUser = findDuplicateUser(users, {
          ownerId: currentOwnerId,
          phone: normalizedPhone,
          name: form.name,
        });

        if (duplicateUser) {
          throw new Error("User already exists.");
        }

        const userDocId = buildUserDocId({
          ownerId: currentOwnerId,
          phone: normalizedPhone,
          name: form.name,
        });
        const userDocRef = doc(db, "users", userDocId);

        await setDoc(userDocRef, {
          ...data,
          ownerId: currentOwnerId,
          createdAt: serverTimestamp(),
          customerId: getNextCustomerId(users),
        });
      }
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
      const historyEntries = Array.isArray(existingUser?.statusHistory)
        ? existingUser.statusHistory
        : [];
      const now = new Date();
      const membershipHistory = buildUpdatedMembershipHistory({
        user: existingUser,
        nextStatus: "Inactive",
        joinDate: existingUser?.joinDate || now,
        now,
      });
      await updateDoc(doc(db, "users", id), {
        active: false,
        status: "Inactive",
        inactiveDate: serverTimestamp(),
        disconnectedAt: serverTimestamp(),
        membershipHistory,
        statusHistory: [
          ...historyEntries,
          { status: "Inactive", date: now.toISOString() },
        ],
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
          packageName.trim().toLowerCase() ===
          category.name.trim().toLowerCase(),
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
        const alreadyPresent = current.some(
          (item) => item.id === optimisticRemoval.id,
        );
        if (alreadyPresent) return current;
        return [...current, optimisticRemoval];
      });
      toast.error(`Could not delete category: ${error.message}`);
    }
  };

  return (
    <div className="page users-page">
      <section className="panel users-panel">
        {((showStandaloneMobileDetail || showDesktopDetail) && selectedUser) ? (
          <UserProfile
            user={selectedUser}
            payments={payments}
            onBack={closeUserDetails}
            onEdit={() => setForm(selectedUser)}
            onAddPayment={() => openAddPayment(selectedUser)}
            onPaymentHistory={() => openPaymentHistory(selectedUser)}
            onDelete={() => setDeleteUser(selectedUser)}
            currentDate={balanceDate}
          />
        ) : (
          <>
            <div className="users-page-header">
              <div className="users-page-heading">
                <h1>{t("users")}</h1>
                <p>
                  {t(
                    "manage_users_subtitle",
                    "Manage customers and account information.",
                  )}
                </p>
              </div>
            </div>
            <div className="users-toolbar">
              <div className="users-toolbar-left">
                <label className="search users-search">
                  <FiSearch />
                  <input
                    ref={searchRef}
                    placeholder={t(
                      "search_users_placeholder",
                      "Search users by name, category or phone...",
                    )}
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
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalPages={totalPages}
              totalUsers={totalUsers}
              startIndex={startIndex}
              endIndex={endIndex}
              selectedUserId={selectedUserId}
              onSelectUser={openUserDetails}
              userBalanceById={userBalanceById}
              balanceReady={!paymentsLoading}
            />
          </>
        )}
      </section>
      {form && (
        <Modal
          title={form.id ? t("EDIT USER") : t("ADD USER")}
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
          title={t("Delete user", "Delete user")}
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
          message={t(
            "delete_category_confirm",
            "Are you sure you want to delete this category?",
          )}
          confirmText={t("delete", "Delete")}
          cancelText={t("cancel", "Cancel")}
          onConfirm={() => removeCategory(categoryToRemove)}
          onCancel={() => setCategoryToRemove(null)}
        />
      )}

     <FloatingSearch targetRef={searchRef} />
    </div>
  );
}
