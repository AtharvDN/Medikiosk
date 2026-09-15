/**
 * Doctor Login View — MediKiosk (Phase 10B Refinement)
 * Provides authenticated clinician access and 4-doctor quick switcher.
 */

import { doctorApi } from '../doctorApi.js';
import { setDoctorAuth } from '../doctorState.js';
import { icons } from '../doctorIcons.js';

export function renderDoctorLoginView() {
  const html = `
    <div class="doc-login-wrap">
      <div class="doc-login-card" style="max-width: 520px;">
        <div class="doc-login-header">
          <div class="doc-login-logo" style="display:flex;align-items:center;justify-content:center;background:#EFF6FF;color:#2563EB;width:54px;height:54px;border-radius:12px;margin:0 auto 12px;">
            ${icons.stethoscope(28, '#2563EB')}
          </div>
          <h1 class="doc-login-title" style="font-size:20px;color:#0F172A;font-weight:700;">MediKiosk Clinical Portal</h1>
          <p class="doc-login-sub" style="font-size:13px;color:#64748B;">District Civil Hospital, Pune • OPD Clinical Workstation</p>
        </div>

        <div id="doc-login-alert" style="display:none; padding:0.75rem; border-radius:6px; margin-bottom:1rem; font-size:0.875rem;"></div>

        <!-- 4-Doctor Quick Switcher Grid -->
        <div style="margin-bottom: 1.5rem; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px;">
          <span style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 8px;">
            Select Demo Clinician (1-Click Login):
          </span>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button type="button" class="btn-demo-doctor" data-doc="priya" style="background:#FFFFFF;border:1px solid #CBD5E1;border-radius:6px;padding:8px 10px;text-align:left;cursor:pointer;transition:all 150ms;">
              <strong style="font-size:12px;color:#0F172A;display:block;">Dr. Priya Deshmukh</strong>
              <span style="font-size:11px;color:#2563EB;">General Medicine</span>
            </button>
            <button type="button" class="btn-demo-doctor" data-doc="ayush" style="background:#FFFFFF;border:1px solid #CBD5E1;border-radius:6px;padding:8px 10px;text-align:left;cursor:pointer;transition:all 150ms;">
              <strong style="font-size:12px;color:#0F172A;display:block;">Dr. Rajendra Joshi</strong>
              <span style="font-size:11px;color:#0D9488;">AYUSH / Ayurveda</span>
            </button>
            <button type="button" class="btn-demo-doctor" data-doc="pedi" style="background:#FFFFFF;border:1px solid #CBD5E1;border-radius:6px;padding:8px 10px;text-align:left;cursor:pointer;transition:all 150ms;">
              <strong style="font-size:12px;color:#0F172A;display:block;">Dr. Neha Kulkarni</strong>
              <span style="font-size:11px;color:#D97706;">Pediatrics</span>
            </button>
            <button type="button" class="btn-demo-doctor" data-doc="ortho" style="background:#FFFFFF;border:1px solid #CBD5E1;border-radius:6px;padding:8px 10px;text-align:left;cursor:pointer;transition:all 150ms;">
              <strong style="font-size:12px;color:#0F172A;display:block;">Dr. Arjun Patil</strong>
              <span style="font-size:11px;color:#7C3AED;">Orthopaedics</span>
            </button>
          </div>
        </div>

        <form id="doc-login-form">
          <div class="doc-form-group">
            <label class="doc-form-label" for="doc-login-id">Employee / Registration ID / Email</label>
            <input
              type="text"
              id="doc-login-id"
              class="doc-form-input"
              placeholder="e.g. DOC-8942 or doctor@medikiosk.local"
              value="DOC-8942"
              required
            />
          </div>

          <div class="doc-form-group">
            <label class="doc-form-label" for="doc-login-dept">Clinical Department</label>
            <input
              type="text"
              id="doc-login-dept"
              class="doc-form-input"
              placeholder="e.g. General Medicine / OPD-3"
              value="General Medicine"
              required
            />
          </div>

          <div class="doc-form-group">
            <label class="doc-form-label" for="doc-login-pass">Password / Digital Token</label>
            <input
              type="password"
              id="doc-login-pass"
              class="doc-form-input"
              placeholder="••••••••"
              value="Password123!"
              required
            />
          </div>

          <button type="submit" id="doc-login-submit" class="doc-btn-login" style="display:flex;align-items:center;justify-content:center;gap:8px;">
            <span>Access Clinical Dashboard</span>
            ${icons.arrowRight(16, '#FFFFFF')}
          </button>
        </form>

        <div style="margin-top: 1.5rem; text-align: center;">
          <a href="#/kiosk" id="doc-return-kiosk-link" style="color: #64748b; font-size: 0.82rem; text-decoration: none;">
            ← Return to Patient Self-Service Kiosk
          </a>
        </div>
      </div>
    </div>
  `;

  function attachEvents() {
    const form = document.getElementById('doc-login-form');
    const alertBox = document.getElementById('doc-login-alert');
    const submitBtn = document.getElementById('doc-login-submit');
    const returnKiosk = document.getElementById('doc-return-kiosk-link');

    returnKiosk?.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '#/kiosk';
    });

    async function handleLogin(employeeId, password, department) {
      if (alertBox) alertBox.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying Credentials...';
      }

      try {
        const res = await doctorApi.login({
          employeeId,
          password,
          department,
        });

        if (res.success && res.data?.token) {
          setDoctorAuth(res.data.doctor, res.data.token);
        } else {
          throw new Error('Authentication failed');
        }
      } catch (err) {
        if (alertBox) {
          alertBox.style.display = 'block';
          alertBox.style.background = '#fef2f2';
          alertBox.style.color = '#dc2626';
          alertBox.style.border = '1px solid #fecaca';
          alertBox.textContent = err.message || 'Login failed. Please check your credentials.';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Access Clinical Dashboard';
        }
      }
    }

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const employeeId = document.getElementById('doc-login-id')?.value.trim();
      const department = document.getElementById('doc-login-dept')?.value.trim();
      const password = document.getElementById('doc-login-pass')?.value;
      handleLogin(employeeId, password, department);
    });

    // 4-Doctor switcher clicks
    document.querySelectorAll('.btn-demo-doctor').forEach((btn) => {
      btn.addEventListener('click', () => {
        const docType = btn.getAttribute('data-doc');
        if (docType === 'priya') {
          document.getElementById('doc-login-id').value = 'DOC-8942';
          document.getElementById('doc-login-dept').value = 'General Medicine';
          handleLogin('DOC-8942', 'Password123!', 'General Medicine');
        } else if (docType === 'ayush') {
          document.getElementById('doc-login-id').value = 'DOC-AYUSH-01';
          document.getElementById('doc-login-dept').value = 'Ayurveda & Integrative Medicine';
          handleLogin('DOC-AYUSH-01', 'Password123!', 'Ayurveda & Integrative Medicine');
        } else if (docType === 'pedi') {
          document.getElementById('doc-login-id').value = 'DOC-PEDI-01';
          document.getElementById('doc-login-dept').value = 'Pediatrics';
          handleLogin('DOC-PEDI-01', 'Password123!', 'Pediatrics');
        } else if (docType === 'ortho') {
          document.getElementById('doc-login-id').value = 'DOC-ORTHO-01';
          document.getElementById('doc-login-dept').value = 'Orthopaedics';
          handleLogin('DOC-ORTHO-01', 'Password123!', 'Orthopaedics');
        }
      });
    });
  }

  return { html, attachEvents };
}
