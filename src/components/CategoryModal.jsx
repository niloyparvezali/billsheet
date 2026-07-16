import { useState } from "react";
import { addDoc, collection, doc, serverTimestamp } from "firebase/firestore";

import toast from "react-hot-toast";
import { FiTrash2 } from "react-icons/fi";

import Modal from "./Modal";
import { db } from "../firebase/config";
export default function CategoryModal({
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
