const supabaseClient = window.supabaseClient;
const page = document.body.dataset.page;
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const emptyData = () => ({ departments: [], employees: [], payroll: [] });
let currentData = emptyData();
const accessMode = "public";

function readData() {
  return {
    departments: currentData.departments.map((item) => ({ ...item })),
    employees: currentData.employees.map((item) => ({ ...item })),
    payroll: currentData.payroll.map((item) => ({ ...item })),
  };
}

function throwIfError(error) {
  if (error) throw new Error(error.message || "Permintaan Supabase gagal.");
}

async function loadRemoteData() {
  const [departments, employees, payroll] = await Promise.all([
    supabaseClient.from("departemen").select("*").order("nama_departemen"),
    supabaseClient.from("karyawan").select("*").order("nama"),
    supabaseClient.from("penggajian").select("*, karyawan(nama,jabatan)").order("periode", { ascending: false }),
  ]);
  [departments, employees, payroll].forEach((result) => throwIfError(result.error));
  currentData = {
    departments: departments.data.map((item) => ({ ...item, id: item.id_departemen })),
    employees: employees.data.map((item) => ({ ...item, id: item.id_karyawan })),
    payroll: payroll.data.map((item) => ({
      ...item,
      id: item.id_penggajian,
      periode: item.periode.slice(0, 7),
      nama_karyawan: item.karyawan?.nama ?? "Karyawan tidak ditemukan",
      jabatan: item.karyawan?.jabatan ?? "",
    })),
  };
}

function changedItems(previous, next) {
  const oldItems = new Map(previous.map((item) => [item.id, item]));
  const newItems = new Map(next.map((item) => [item.id, item]));
  return {
    removed: [...oldItems.keys()].filter((itemId) => !newItems.has(itemId)),
    changed: next.filter((item) => JSON.stringify(oldItems.get(item.id)) !== JSON.stringify(item)),
  };
}

async function persistData(previous, next) {
  const departments = changedItems(previous.departments, next.departments);
  const employees = changedItems(previous.employees, next.employees);
  const payroll = changedItems(previous.payroll, next.payroll);
  const remove = async (table, column, ids) => {
    if (!ids.length) return;
    const { error } = await supabaseClient.from(table).delete().in(column, ids);
    throwIfError(error);
  };
  const upsert = async (table, rows) => {
    if (!rows.length) return;
    const { error } = await supabaseClient.from(table).upsert(rows);
    throwIfError(error);
  };
  const removedEmployeePayrollIds = previous.payroll
    .filter((item) => employees.removed.includes(item.id_karyawan))
    .map((item) => item.id);
  await remove("penggajian", "id_penggajian", [...new Set([...payroll.removed, ...removedEmployeePayrollIds])]);
  await remove("karyawan", "id_karyawan", employees.removed);
  await remove("departemen", "id_departemen", departments.removed);
  await upsert("departemen", departments.changed.map(({ id, ...item }) => ({ ...item, id_departemen: id })));
  await upsert("karyawan", employees.changed.map(({ id, ...item }) => ({ ...item, id_karyawan: id })));
  await upsert("penggajian", payroll.changed.map(({ id, nama_karyawan, jabatan, karyawan, total_gaji, ...item }) => ({
    ...item,
    id_penggajian: id,
    periode: `${item.periode}-01`,
  })));
}

async function writeData(data) {
  await persistData(currentData, data);
  currentData = data;
}

function id() {
  return crypto.randomUUID();
}

function money(value) {
  return rupiah.format(Number(value) || 0);
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function toast(message, error = false) {
  const box = document.querySelector("#notifications");
  if (!box) return;
  const item = document.createElement("div");
  item.className = `toast${error ? " toast-error" : ""}`;
  item.textContent = message;
  box.append(item);
  setTimeout(() => item.remove(), 4000);
}

function setIdentity() {
  document.querySelectorAll("[data-user-name]").forEach((node) => node.textContent = "Administrator");
  document.querySelectorAll("[data-user-role]").forEach((node) => node.textContent = "Payroll Management");
  document.querySelectorAll("[data-admin-only], [data-payroll-only]").forEach((node) => node.hidden = false);
}

function shortDate(value) {
  return value ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "—";
}

function periodName(value) {
  if (typeof value !== "string") return "—";
  const [year, month] = value.slice(0, 7).split("-");
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(Number(year), Number(month) - 1));
}

function errorRow(selector, colspan, error) {
  document.querySelector(selector).innerHTML = `<tr><td colspan="${colspan}" class="error-cell">${safe(error.message)}</td></tr>`;
}

function loadDashboard() {
  try {
    const data = readData();
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentPayroll = data.payroll.filter((item) => item.periode === month);
    const latest = [...data.payroll].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
    document.querySelector("#dashboard-content").innerHTML = `
      <section class="stats-grid">
        <article class="stat-card"><span class="stat-icon">♙</span><div><p>Total karyawan</p><strong>${data.employees.length}</strong><small>Tersimpan di Supabase</small></div></article>
        ${accessMode !== "viewer" ? `<article class="stat-card"><span class="stat-icon gold">Rp</span><div><p>Total gaji bulan ini</p><strong>${money(currentPayroll.reduce((sum, item) => sum + item.total_gaji, 0))}</strong><small>Periode berjalan</small></div></article>` : ""}
        <article class="stat-card"><span class="stat-icon">▤</span><div><p>Departemen</p><strong>${data.departments.length}</strong><small>Unit organisasi</small></div></article>
      </section>
      ${accessMode !== "viewer" ? `<section class="panel"><div class="panel-heading"><div><h2>Penggajian terbaru</h2><p>Data tersimpan di Supabase</p></div><a class="text-link" href="penggajian.html">Lihat semua →</a></div>
      ${latest.length ? `<div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Periode</th><th>Total gaji</th><th>Tanggal dicatat</th></tr></thead><tbody>${latest.map((item) => `<tr><td><strong>${safe(item.nama_karyawan)}</strong></td><td>${periodName(item.periode)}</td><td>${money(item.total_gaji)}</td><td>${shortDate(item.created_at)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="empty-state">Belum ada catatan penggajian.</p>'}
      </section>` : ""}
      `;
  } catch (error) {
    document.querySelector("#dashboard-content").innerHTML = `<section class="panel error-cell">${safe(error.message)}</section>`;
  }
}

function loadEmployees() {
  const body = document.querySelector("#employee-rows");
  const search = document.querySelector("#employee-search");
  const render = () => {
    try {
      const data = readData();
      const keyword = search.value.trim().toLocaleLowerCase("id");
      const employees = data.employees.filter((employee) => {
        const dept = data.departments.find((item) => item.id === employee.id_departemen)?.nama_departemen ?? "";
        return [employee.nama, employee.email, employee.jabatan, dept].some((value) => value.toLocaleLowerCase("id").includes(keyword));
      });
      body.innerHTML = employees.length ? employees.map((employee) => {
        const dept = data.departments.find((item) => item.id === employee.id_departemen);
        return `<tr><td><strong>${safe(employee.nama)}</strong><span class="sub-cell">${safe(employee.email)}</span></td><td>${safe(employee.jabatan)}</td>
          <td>${safe(dept?.nama_departemen ?? "—")}</td><td>${safe(employee.no_hp || "—")}</td>
          ${accessMode !== "viewer" ? `<td>${money(employee.gaji_pokok)}</td>` : ""}
          ${accessMode === "public" ? `<td class="actions"><a class="icon-button" href="tambah-karyawan.html?id=${encodeURIComponent(employee.id)}" title="Edit">↗</a>
          <button class="icon-button danger" data-remove-employee="${safe(employee.id)}" title="Hapus">×</button></td>` : ""}</tr>`;
      }).join("") : '<tr><td colspan="6"><p class="empty-state">Tidak ada data karyawan.</p></td></tr>';
    } catch (error) { errorRow("#employee-rows", 6, error); }
  };
  search.addEventListener("input", render);
  body.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove-employee]");
    if (!button || !confirm("Hapus karyawan dan catatan penggajian terkait dari Supabase?")) return;
    try {
      const data = readData();
      data.employees = data.employees.filter((employee) => employee.id !== button.dataset.removeEmployee);
      data.payroll = data.payroll.filter((item) => item.id_karyawan !== button.dataset.removeEmployee);
      await writeData(data);
      toast("Data karyawan dihapus.");
      render();
    } catch (error) { toast(error.message, true); }
  });
  render();
}

function loadEmployeeForm() {
  const form = document.querySelector("#employee-form");
  const editId = new URLSearchParams(location.search).get("id");
  try {
    const data = readData();
    form.elements.id_departemen.innerHTML = '<option value="">Pilih departemen</option>' + data.departments.map((dept) =>
      `<option value="${safe(dept.id)}">${safe(dept.nama_departemen)}</option>`).join("");
    if (!data.departments.length) toast("Tambahkan departemen sebelum membuat karyawan.", true);
    if (editId) {
      const employee = data.employees.find((item) => item.id === editId);
      if (!employee) throw new Error("Karyawan tidak ditemukan dalam data browser.");
      document.querySelector("#employee-form-title").textContent = "Edit karyawan";
      ["nama", "email", "no_hp", "jabatan", "gaji_pokok", "id_departemen"].forEach((key) => {
        form.elements[key].value = employee[key] ?? "";
      });
    }
  } catch (error) { toast(error.message, true); }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      const data = readData();
      const email = form.elements.email.value.trim().toLowerCase();
      const salary = Number(form.elements.gaji_pokok.value);
      if (data.employees.some((employee) => employee.email === email && employee.id !== editId)) throw new Error("Email sudah digunakan.");
      if (!Number.isFinite(salary) || salary < 0) throw new Error("Gaji pokok harus nol atau lebih.");
      const employee = {
        id: editId ?? id(),
        nama: form.elements.nama.value.trim(),
        email,
        no_hp: form.elements.no_hp.value.trim(),
        jabatan: form.elements.jabatan.value.trim(),
        gaji_pokok: salary,
        id_departemen: form.elements.id_departemen.value,
        created_at: editId ? data.employees.find((item) => item.id === editId).created_at : new Date().toISOString(),
      };
      if (!employee.nama || !employee.jabatan || !employee.id_departemen) throw new Error("Lengkapi seluruh data wajib.");
      data.employees = editId
        ? data.employees.map((item) => item.id === editId ? employee : item)
        : [...data.employees, employee];
      await writeData(data);
      toast("Data karyawan berhasil disimpan di Supabase.");
      setTimeout(() => location.assign("karyawan.html"), 350);
    } catch (error) {
      toast(error.message, true);
      button.disabled = false;
    }
  });
}

function resetDepartmentForm(form) {
  form.reset();
  form.elements.id_departemen.value = "";
  document.querySelector("#department-form-title").textContent = "Tambah departemen";
  document.querySelector("#department-save").textContent = "Simpan departemen";
}

function loadDepartments() {
  const form = document.querySelector("#department-form");
  const body = document.querySelector("#department-rows");
  const render = () => {
    try {
      const data = readData();
      body.innerHTML = data.departments.length ? data.departments.map((dept) => `<tr>
        <td><strong>${safe(dept.nama_departemen)}</strong></td><td>${safe(dept.deskripsi || "—")}</td>
        <td>${data.employees.filter((employee) => employee.id_departemen === dept.id).length}</td>
        ${accessMode === "public" ? `<td class="actions"><button class="icon-button" data-edit-dept="${safe(dept.id)}" title="Edit">↗</button>
        <button class="icon-button danger" data-remove-dept="${safe(dept.id)}" title="Hapus">×</button></td>` : ""}</tr>`).join("")
        : '<tr><td colspan="4"><p class="empty-state">Belum ada departemen.</p></td></tr>';
    } catch (error) { errorRow("#department-rows", 4, error); }
  };
  body.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit-dept]");
    const remove = event.target.closest("[data-remove-dept]");
    try {
      const data = readData();
      if (edit) {
        const dept = data.departments.find((item) => item.id === edit.dataset.editDept);
        if (!dept) throw new Error("Departemen tidak ditemukan.");
        form.elements.id_departemen.value = dept.id;
        form.elements.nama_departemen.value = dept.nama_departemen;
        form.elements.deskripsi.value = dept.deskripsi;
        document.querySelector("#department-form-title").textContent = "Edit departemen";
        document.querySelector("#department-save").textContent = "Simpan perubahan";
        form.scrollIntoView({ behavior: "smooth" });
      }
      if (remove) {
        if (data.employees.some((employee) => employee.id_departemen === remove.dataset.removeDept)) {
          throw new Error("Departemen masih digunakan oleh karyawan.");
        }
        if (!confirm("Hapus departemen ini?")) return;
        data.departments = data.departments.filter((item) => item.id !== remove.dataset.removeDept);
        await writeData(data);
        toast("Departemen dihapus.");
        render();
      }
    } catch (error) { toast(error.message, true); }
  });
  document.querySelector("#department-cancel").addEventListener("click", () => resetDepartmentForm(form));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.querySelector("#department-save");
    const editId = form.elements.id_departemen.value;
    button.disabled = true;
    try {
      const data = readData();
      const name = form.elements.nama_departemen.value.trim();
      if (!name) throw new Error("Nama departemen wajib diisi.");
      if (data.departments.some((dept) => dept.nama_departemen.toLocaleLowerCase("id") === name.toLocaleLowerCase("id") && dept.id !== editId)) {
        throw new Error("Nama departemen sudah digunakan.");
      }
      const dept = {
        id: editId || id(),
        nama_departemen: name,
        deskripsi: form.elements.deskripsi.value.trim(),
        created_at: editId ? data.departments.find((item) => item.id === editId)?.created_at ?? new Date().toISOString() : new Date().toISOString(),
      };
      data.departments = editId
        ? data.departments.map((item) => item.id === editId ? dept : item)
        : [...data.departments, dept];
      await writeData(data);
      toast("Departemen berhasil disimpan.");
      resetDepartmentForm(form);
      render();
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  });
  render();
}

function loadPayroll() {
  const body = document.querySelector("#payroll-rows");
  const filter = document.querySelector("#payroll-period");
  const render = () => {
    try {
      const data = readData();
      const rows = [...data.payroll]
        .filter((item) => !filter.value || item.periode === filter.value)
        .sort((a, b) => b.periode.localeCompare(a.periode) || b.created_at.localeCompare(a.created_at));
      body.innerHTML = rows.length ? rows.map((record) => `<tr>
        <td><strong>${safe(record.nama_karyawan)}</strong><span class="sub-cell">${safe(record.jabatan)}</span></td>
        <td>${periodName(record.periode)}</td><td>${money(record.gaji_pokok)}</td><td>${money(record.tunjangan)}</td>
        <td>${money(record.potongan)}</td><td class="total-amount">${money(record.total_gaji)}</td>
        <td class="actions" data-payroll-only><a class="icon-button" href="tambah-penggajian.html?id=${encodeURIComponent(record.id)}" title="Edit">↗</a>
        <button class="icon-button danger" data-remove-payroll="${safe(record.id)}" title="Hapus">×</button></td></tr>`).join("")
        : '<tr><td colspan="7"><p class="empty-state">Belum ada penggajian pada periode ini.</p></td></tr>';
    } catch (error) { errorRow("#payroll-rows", 7, error); }
  };
  filter.addEventListener("change", render);
  body.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove-payroll]");
    if (!button || !confirm("Hapus catatan penggajian ini?")) return;
    try {
      const data = readData();
      data.payroll = data.payroll.filter((item) => item.id !== button.dataset.removePayroll);
      await writeData(data);
      toast("Catatan penggajian dihapus.");
      render();
    } catch (error) { toast(error.message, true); }
  });
  render();
}

function loadPayrollForm() {
  const form = document.querySelector("#payroll-form");
  const editId = new URLSearchParams(location.search).get("id");
  try {
    const data = readData();
    form.elements.id_karyawan.innerHTML = '<option value="">Pilih karyawan</option>' + data.employees.map((employee) =>
      `<option value="${safe(employee.id)}">${safe(employee.nama)} · ${money(employee.gaji_pokok)}</option>`).join("");
    if (!data.employees.length) toast("Tambahkan karyawan terlebih dahulu.", true);
    if (editId) {
      const record = data.payroll.find((item) => item.id === editId);
      if (!record) throw new Error("Penggajian tidak ditemukan.");
      document.querySelector("#payroll-form-title").textContent = "Edit penggajian";
      form.elements.id_karyawan.value = record.id_karyawan;
      form.elements.periode.value = record.periode;
      form.elements.tunjangan.value = record.tunjangan;
      form.elements.potongan.value = record.potongan;
    } else {
      const now = new Date();
      form.elements.periode.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
  } catch (error) { toast(error.message, true); }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    try {
      const data = readData();
      const employee = data.employees.find((item) => item.id === form.elements.id_karyawan.value);
      if (!employee) throw new Error("Pilih karyawan yang tersedia.");
      const period = form.elements.periode.value;
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("Periode penggajian tidak valid.");
      const allowance = Number(form.elements.tunjangan.value);
      const deduction = Number(form.elements.potongan.value);
      if (![allowance, deduction].every((amount) => Number.isFinite(amount) && amount >= 0)) {
        throw new Error("Tunjangan dan potongan harus berupa nominal nol atau lebih.");
      }
      if (deduction > employee.gaji_pokok + allowance) throw new Error("Potongan melebihi total pendapatan.");
      if (data.payroll.some((item) => item.id_karyawan === employee.id && item.periode === period && item.id !== editId)) {
        throw new Error("Penggajian untuk karyawan dan periode ini sudah tercatat.");
      }
      const record = {
        id: editId ?? id(),
        id_karyawan: employee.id,
        nama_karyawan: employee.nama,
        jabatan: employee.jabatan,
        periode: period,
        gaji_pokok: employee.gaji_pokok,
        tunjangan: allowance,
        potongan: deduction,
        total_gaji: Math.round((employee.gaji_pokok + allowance - deduction) * 100) / 100,
        created_at: editId ? data.payroll.find((item) => item.id === editId).created_at : new Date().toISOString(),
      };
      data.payroll = editId
        ? data.payroll.map((item) => item.id === editId ? record : item)
        : [...data.payroll, record];
      await writeData(data);
      toast("Penggajian berhasil disimpan di Supabase.");
      setTimeout(() => location.assign("penggajian.html"), 350);
    } catch (error) {
      toast(error.message, true);
      button.disabled = false;
    }
  });
}

async function initialize() {
  document.querySelector("#menu-toggle")?.addEventListener("click", () => document.querySelector(".sidebar")?.classList.toggle("sidebar-open"));
  if (page === "login") {
    location.replace("dashboard.html");
    return;
  }

  await loadRemoteData();
  setIdentity();
  if (page === "dashboard") loadDashboard();
  if (page === "employees") loadEmployees();
  if (page === "employee-form") loadEmployeeForm();
  if (page === "departments") loadDepartments();
  if (page === "payroll") loadPayroll();
  if (page === "payroll-form") loadPayrollForm();
}

try {
  initialize().catch((error) => toast(`Aplikasi tidak dapat dimuat: ${error.message}`, true));
} catch (error) {
  toast(`Aplikasi tidak dapat dimuat: ${error.message}`, true);
}
