/*
 * VOGUEPAY backend business rules.
 *
 * These pure functions define payroll validation rules. The browser client
 * accesses the public Supabase tables from frontend/app.js.
 */

(function exposePayrollRules(root) {
  "use strict";

  const MONEY_LIMIT = 9999999999999.99;

  function text(value, field, maxLength) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
      throw new TypeError(`${field} wajib diisi (maksimal ${maxLength} karakter).`);
    }
    return value.trim();
  }

  function amount(value, field) {
    const normalized = typeof value === "number" ? String(value) : value;
    if (typeof normalized !== "string" || !/^\d{1,13}(\.\d{1,2})?$/.test(normalized)) {
      throw new TypeError(`${field} harus nominal nol atau lebih dengan maksimal dua desimal.`);
    }
    const result = Number(normalized);
    if (!Number.isFinite(result) || result < 0 || result > MONEY_LIMIT) {
      throw new RangeError(`${field} di luar batas nominal yang diperbolehkan.`);
    }
    return Math.round(result * 100) / 100;
  }

  function validateEmployee(input) {
    const email = text(input.email, "Email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TypeError("Format email tidak valid.");
    return {
      nama: text(input.nama, "Nama", 160),
      email,
      no_hp: typeof input.no_hp === "string" ? input.no_hp.trim().slice(0, 30) : "",
      jabatan: text(input.jabatan, "Jabatan", 120),
      gaji_pokok: amount(input.gaji_pokok, "Gaji pokok"),
      id_departemen: text(input.id_departemen, "Departemen", 64),
    };
  }

  function validateDepartment(input) {
    return {
      nama_departemen: text(input.nama_departemen, "Nama departemen", 120),
      deskripsi: typeof input.deskripsi === "string" ? input.deskripsi.trim().slice(0, 1000) : "",
    };
  }

  function calculatePayroll(input, employee) {
    if (!employee || typeof employee !== "object") throw new TypeError("Data karyawan wajib tersedia.");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.periode)) {
      throw new TypeError("Periode harus berformat YYYY-MM.");
    }
    const baseSalary = amount(employee.gaji_pokok, "Gaji pokok");
    const allowance = amount(input.tunjangan ?? 0, "Tunjangan");
    const deduction = amount(input.potongan ?? 0, "Potongan");
    if (deduction > baseSalary + allowance) {
      throw new RangeError("Potongan tidak boleh melebihi gaji pokok ditambah tunjangan.");
    }
    const total = Math.round((baseSalary + allowance - deduction) * 100) / 100;
    return {
      id_karyawan: employee.id_karyawan,
      periode: `${input.periode}-01`,
      gaji_pokok: baseSalary,
      tunjangan: allowance,
      potongan: deduction,
      total_gaji: total,
    };
  }

  root.VoguepayBackendRules = Object.freeze({
    validateEmployee,
    validateDepartment,
    calculatePayroll,
  });
})(globalThis);
