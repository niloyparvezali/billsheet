import { FiEdit2, FiTrash2 } from "react-icons/fi";
export default function UsersTable({
  list,
  setForm,
  setDeleteUser,
  money,
  formatDate,
  currentPage,
  setCurrentPage,
  totalPages,
  totalUsers,
  startIndex,
  endIndex,
}) {
  return (
    <div className="table-wrap">
      <table className="users-table">
        <thead>
          <tr>
            <th style={{ width: "70px" }}>SL</th>
            <th>Name</th>
            <th style={{ width: "170px" }}>Category</th>
            <th style={{ width: "170px" }}>Monthly Bill</th>
            <th style={{ width: "190px" }}>Phone</th>
            <th style={{ width: "170px" }}>Created</th>
            <th className="actions-header">Action</th>
          </tr>
        </thead>
        <tbody>
          {list.map((user, i) => (
            <tr key={user.id}>
              <td data-label="SL">{i + 1}</td>
              <td data-label="Name">
                <strong className="user-name">{user.name}</strong>
              </td>
              <td data-label="Category">
                <span className="user-category">{user.category}</span>
              </td>
              <td data-label="Monthly Bill">{money(user.monthlyBill)}</td>
              <td data-label="Phone">{user.phone || "—"}</td>
              <td data-label="Created">{formatDate(user.createdAt)}</td>
              <td className="actions actions-cell" data-label="Action">
                <button onClick={() => setForm(user)}>
                  <FiEdit2 />
                </button>
                <button className="danger" onClick={() => setDeleteUser(user)}>
                  <FiTrash2 />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="users-mobile-list">
        {list.map((user, i) => (
          <div className="user-card" key={`mobile-${user.id}`}>
            <div className="user-card-header">
              <div>
                <h3>{user.name}</h3>
                <span className="user-category">{user.category}</span>
              </div>
            </div>

            <div className="user-card-body">
              <div className="user-card-row">
                <span>Monthly Bill</span>
                <strong>{money(user.monthlyBill)}</strong>
              </div>

              <div className="user-card-row">
                <span>Phone</span>
                <strong>{user.phone || "—"}</strong>
              </div>

              <div className="user-card-row">
                <span>Created</span>
                <strong>{formatDate(user.createdAt)}</strong>
              </div>
            </div>
            <div className="user-card-row user-card-action-row">
              <span>Action</span>

              <div className="user-card-actions">
                <button
                  className="edit-btn"
                  onClick={() => setForm(user)}
                  title="Edit User"
                >
                  <FiEdit2 />
                </button>

                <button
                  className="danger delete-btn"
                  onClick={() => setDeleteUser(user)}
                  title="Delete User"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="table-footer">
        <div className="table-footer-info">
          Showing {startIndex + 1}–{endIndex} of {totalUsers} users
        </div>

        <div className="table-footer-page">
          Page {currentPage} of {totalPages}
        </div>

        <div className="table-footer-nav">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            ◀ Previous
          </button>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next ▶
          </button>
        </div>
      </div>
      {!list.length && <p className="empty">No users match your search.</p>}
    </div>
  );
}
