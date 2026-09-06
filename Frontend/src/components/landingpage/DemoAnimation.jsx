import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import '@/styles/auth.css';

export default function DemoAnimation() {
  const [step, setStep] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    type: 'Customer',
    email: '',
    mobile: '',
    city: '',
    state: '',
    pincode: '',
    portal: false,
  });

  const [activeField, setActiveField] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 92, y: 10 });
  const [cursorClick, setCursorClick] = useState(false);
  const [btnPressed, setBtnPressed] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [tableHighlight, setTableHighlight] = useState(false);

  useEffect(() => {
    let timeout;

    // Calm, premium SaaS demo pacing with slower typing and smooth mouse movements
    if (step === 0) {
      // Step 0: Mouse smoothly enters frame toward Name field
      timeout = setTimeout(() => {
        setCursorPos({ x: 26, y: 27 });
        setActiveField('name');
        setStep(1);
      }, 1200);
    } else if (step === 1) {
      // Step 1: Calm typing for Name "Azure Furniture"
      const text = "Azure Furniture";
      let i = 0;
      const interval = setInterval(() => {
        if (i <= text.length) {
          setFormData((prev) => ({ ...prev, name: text.slice(0, i) }));
          i++;
        } else {
          clearInterval(interval);
          timeout = setTimeout(() => {
            setCursorPos({ x: 74, y: 41 });
            setActiveField('email');
            setStep(2);
          }, 400);
        }
      }, 100);
      return () => clearInterval(interval);
    } else if (step === 2) {
      // Step 2: Calm typing for Email "contact@azurefurniture.com"
      const text = "contact@azurefurniture.com";
      let i = 0;
      const interval = setInterval(() => {
        if (i <= text.length) {
          setFormData((prev) => ({ ...prev, email: text.slice(0, i) }));
          i++;
        } else {
          clearInterval(interval);
          // Activate portal access smoothly
          setFormData((prev) => ({ ...prev, portal: true }));
          timeout = setTimeout(() => {
            setCursorPos({ x: 26, y: 55 });
            setActiveField('mobile');
            setStep(3);
          }, 400);
        }
      }, 80);
      return () => clearInterval(interval);
    } else if (step === 3) {
      // Step 3: Calm typing for Mobile "9876543210"
      const text = "9876543210";
      let i = 0;
      const interval = setInterval(() => {
        if (i <= text.length) {
          setFormData((prev) => ({ ...prev, mobile: text.slice(0, i) }));
          i++;
        } else {
          clearInterval(interval);
          timeout = setTimeout(() => {
            setCursorPos({ x: 74, y: 55 });
            setActiveField('city');
            setStep(4);
          }, 400);
        }
      }, 95);
      return () => clearInterval(interval);
    } else if (step === 4) {
      // Step 4: Calm typing for City "Ahmedabad"
      const text = "Ahmedabad";
      let i = 0;
      const interval = setInterval(() => {
        if (i <= text.length) {
          setFormData((prev) => ({ ...prev, city: text.slice(0, i) }));
          i++;
        } else {
          clearInterval(interval);
          timeout = setTimeout(() => {
            setCursorPos({ x: 26, y: 69 });
            setActiveField('state');
            setStep(5);
          }, 400);
        }
      }, 100);
      return () => clearInterval(interval);
    } else if (step === 5) {
      // Step 5: Calm typing for State "Gujarat"
      const text = "Gujarat";
      let i = 0;
      const interval = setInterval(() => {
        if (i <= text.length) {
          setFormData((prev) => ({ ...prev, state: text.slice(0, i) }));
          i++;
        } else {
          clearInterval(interval);
          timeout = setTimeout(() => {
            setCursorPos({ x: 74, y: 69 });
            setActiveField('pincode');
            setStep(6);
          }, 400);
        }
      }, 100);
      return () => clearInterval(interval);
    } else if (step === 6) {
      // Step 6: Calm typing for Pincode "380015"
      const text = "380015";
      let i = 0;
      const interval = setInterval(() => {
        if (i <= text.length) {
          setFormData((prev) => ({ ...prev, pincode: text.slice(0, i) }));
          i++;
        } else {
          clearInterval(interval);
          setActiveField(null);
          timeout = setTimeout(() => {
            setCursorPos({ x: 10, y: 85 });
            setStep(8);
          }, 500);
        }
      }, 100);
      return () => clearInterval(interval);
    } else if (step === 8) {
      // Step 8: Smooth click on Create button
      timeout = setTimeout(() => {
        setCursorClick(true);
        setBtnPressed(true);
        setTimeout(() => setCursorClick(false), 250);
        setTimeout(() => {
          setBtnPressed(false);
          setStep(10);
        }, 450);
      }, 700);
    } else if (step === 10) {
      // Step 10: Hold success state before Scene 2 transition
      timeout = setTimeout(() => {
        setStep(11);
      }, 1600);
    } else if (step === 11) {
      // Step 11: Cursor moves to Table Search box in Scene 2
      setCursorPos({ x: 22, y: 11 });
      timeout = setTimeout(() => {
        const text = "Azure Furniture";
        let i = 0;
        const interval = setInterval(() => {
          if (i <= text.length) {
            setTableSearch(text.slice(0, i));
            i++;
          } else {
            clearInterval(interval);
            setTableHighlight(true);
            setStep(12);
          }
        }, 90);
      }, 800);
    } else if (step === 12) {
      // Step 12: Hold Scene 2 table view peacefully before looping
      timeout = setTimeout(() => {
        setFormData({
          name: '',
          type: 'Customer',
          email: '',
          mobile: '',
          city: '',
          state: '',
          pincode: '',
          portal: false,
        });
        setTableSearch('');
        setTableHighlight(false);
        setActiveField(null);
        setCursorPos({ x: 92, y: 10 });
        setStep(0);
      }, 4500);
    }

    return () => clearTimeout(timeout);
  }, [step]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '490px',
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#f8fafc',
        boxShadow: '0 20px 40px -10px rgba(0, 0, 80, 0.12), 0 0 0 1px rgba(0,0,0,0.06)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          fontSize: '0.75rem',
          height: '42px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '5px',
              border: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              color: '#475569',
            }}
          >
            ☰
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f1f5f9',
              padding: '5px 12px',
              borderRadius: '6px',
              width: '240px',
              color: '#64748b',
              fontSize: '0.7rem',
            }}
          >
            <span>🔍</span> Search invoices, bills, contacts...
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>ENGLISH ▾</span>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: '#cbd5e1',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.65rem',
              fontWeight: 700,
            }}
          >
            KJ
          </div>
        </div>
      </div>

      {/* Main Content Area — Fixed Height Container */}
      <div
        style={{
          padding: '14px 18px',
          flex: 1,
          boxSizing: 'border-box',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {step <= 10 ? (
          /* SCENE 1: CONTACT FORM */
          <div style={{ width: '100%', maxWidth: '720px', margin: '0 auto' }}>
            <div style={{ marginBottom: '8px' }}>
              <span
                style={{
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: '#000080',
                  background: '#e0e7ff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                }}
              >
                MASTER DATA
              </span>
              <h2
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: '3px 0 1px',
                  fontFamily: 'Orbitron, sans-serif',
                }}
              >
                New contact
              </h2>
              <p style={{ fontSize: '0.68rem', color: '#64748b', margin: 0 }}>
                Add a customer or vendor.
              </p>
            </div>

            <div
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '14px 18px',
                boxShadow: '0 4px 16px -4px rgba(0,0,0,0.05)',
                border: '1px solid #e2e8f0',
              }}
            >
              {/* Name Field */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                  Name
                </label>
                <div
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: activeField === 'name' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    boxShadow: activeField === 'name' ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                    fontSize: '0.75rem',
                    color: '#0f172a',
                    minHeight: '28px',
                    background: '#fff',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {formData.name || <span style={{ color: '#94a3b8' }}>Azure Furniture</span>}
                </div>
              </div>

              {/* Type & Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                    Type
                  </label>
                  <div style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 600, color: '#0f172a', background: '#fff', minHeight: '28px', display: 'flex', alignItems: 'center' }}>
                    {formData.type}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                    Email
                  </label>
                  <div
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: activeField === 'email' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      boxShadow: activeField === 'email' ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                      fontSize: '0.75rem',
                      color: '#0f172a',
                      minHeight: '28px',
                      background: '#fff',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {formData.email || <span style={{ color: '#94a3b8' }}>name@example.com</span>}
                  </div>
                </div>
              </div>

              {/* Mobile & City */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                    Mobile
                  </label>
                  <div
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: activeField === 'mobile' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      boxShadow: activeField === 'mobile' ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                      fontSize: '0.75rem',
                      color: '#0f172a',
                      minHeight: '28px',
                      background: '#fff',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {formData.mobile || <span style={{ color: '#94a3b8' }}>9876543210</span>}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                    City
                  </label>
                  <div
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: activeField === 'city' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      boxShadow: activeField === 'city' ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                      fontSize: '0.75rem',
                      color: '#0f172a',
                      minHeight: '28px',
                      background: '#fff',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {formData.city || <span style={{ color: '#94a3b8' }}>Ahmedabad</span>}
                  </div>
                </div>
              </div>

              {/* State & Pincode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                    State
                  </label>
                  <div
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: activeField === 'state' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      boxShadow: activeField === 'state' ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                      fontSize: '0.75rem',
                      color: '#0f172a',
                      minHeight: '28px',
                      background: '#fff',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {formData.state || <span style={{ color: '#94a3b8' }}>Gujarat</span>}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                    Pincode
                  </label>
                  <div
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: activeField === 'pincode' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      boxShadow: activeField === 'pincode' ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                      fontSize: '0.75rem',
                      color: '#0f172a',
                      minHeight: '28px',
                      background: '#fff',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {formData.pincode || <span style={{ color: '#94a3b8' }}>380015</span>}
                  </div>
                </div>
              </div>

              {/* Portal Access Box */}
              <div
                style={{
                  background: formData.portal ? '#f0f9ff' : '#f8fafc',
                  border: formData.portal ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '12px',
                  transition: 'all 0.4s ease',
                }}
              >
                <div
                  style={{
                    width: '15px',
                    height: '15px',
                    borderRadius: '4px',
                    background: formData.portal ? '#0284c7' : '#cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  }}
                >
                  {formData.portal ? '✓' : ''}
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a' }}>Portal access</div>
                  <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
                    {formData.portal
                      ? 'Portal access ready for contact@azurefurniture.com'
                      : 'Add an email address before enabling portal access.'}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  style={{
                    padding: '7px 22px',
                    borderRadius: '18px',
                    background: step === 10 ? '#16a34a' : '#000080',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    transform: btnPressed ? 'scale(0.95)' : 'scale(1)',
                    boxShadow: '0 4px 12px rgba(0, 0, 128, 0.2)',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {step === 10 ? (
                    <>
                      <CheckCircle2 size={13} /> Created
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
                <button
                  style={{
                    padding: '7px 18px',
                    borderRadius: '18px',
                    background: 'transparent',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* SCENE 2: CONTACTS LIST TABLE VIEW */
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px -4px rgba(0,0,0,0.05)', width: '100%', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
            {/* Search and Filters */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexShrink: 0 }}>
              <div style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', color: '#0f172a', background: '#fff' }}>
                {tableSearch || <span style={{ color: '#94a3b8' }}>Search...</span>}
              </div>
              <div style={{ width: '110px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 600, color: '#0f172a' }}>
                Status: Active
              </div>
              <div style={{ width: '90px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', color: '#0f172a' }}>
                Type: All
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
                    <th style={{ padding: '7px' }}>NAME</th>
                    <th style={{ padding: '7px' }}>TYPE</th>
                    <th style={{ padding: '7px' }}>EMAIL</th>
                    <th style={{ padding: '7px' }}>MOBILE</th>
                    <th style={{ padding: '7px' }}>CITY</th>
                    <th style={{ padding: '7px' }}>PORTAL</th>
                    <th style={{ padding: '7px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Newly created entry highlighted */}
                  <tr
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: tableHighlight ? '#eff6ff' : 'transparent',
                      transition: 'background 0.6s ease',
                      fontWeight: 700,
                    }}
                  >
                    <td style={{ padding: '7px', color: '#1e40af' }}>Azure Furniture</td>
                    <td style={{ padding: '7px' }}><span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '8px', fontSize: '0.62rem' }}>Customer</span></td>
                    <td style={{ padding: '7px', color: '#475569' }}>contact@azurefurniture.com</td>
                    <td style={{ padding: '7px', color: '#475569' }}>9876543210</td>
                    <td style={{ padding: '7px', color: '#475569' }}>Ahmedabad</td>
                    <td style={{ padding: '7px' }}><span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '8px', fontSize: '0.62rem' }}>Enabled</span></td>
                    <td style={{ padding: '7px', color: '#16a34a' }}>● Active</td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                    <td style={{ padding: '7px', fontWeight: 600 }}>Wakefit Omni-Channel Partner Hub</td>
                    <td style={{ padding: '7px' }}><span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '8px', fontSize: '0.62rem' }}>Both</span></td>
                    <td style={{ padding: '7px' }}>partner20.trade@wakefitomnichan.in</td>
                    <td style={{ padding: '7px' }}>9930006340</td>
                    <td style={{ padding: '7px' }}>Bengaluru</td>
                    <td style={{ padding: '7px' }}><span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '8px', fontSize: '0.62rem' }}>Enabled</span></td>
                    <td style={{ padding: '7px', color: '#16a34a' }}>● Active</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                    <td style={{ padding: '7px', fontWeight: 600 }}>Decornation Trade & Project Furnishings</td>
                    <td style={{ padding: '7px' }}><span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '8px', fontSize: '0.62rem' }}>Both</span></td>
                    <td style={{ padding: '7px' }}>partner19.trade@decornationtrad.in</td>
                    <td style={{ padding: '7px' }}>9930006023</td>
                    <td style={{ padding: '7px' }}>Pune</td>
                    <td style={{ padding: '7px' }}><span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '8px', fontSize: '0.62rem' }}>Enabled</span></td>
                    <td style={{ padding: '7px', color: '#16a34a' }}>● Active</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                    <td style={{ padding: '7px', fontWeight: 600 }}>Herman Miller Commercial Partner</td>
                    <td style={{ padding: '7px' }}><span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '8px', fontSize: '0.62rem' }}>Both</span></td>
                    <td style={{ padding: '7px' }}>partner18.trade@hermanmillercom.in</td>
                    <td style={{ padding: '7px' }}>9930005706</td>
                    <td style={{ padding: '7px' }}>Mumbai</td>
                    <td style={{ padding: '7px' }}><span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '8px', fontSize: '0.62rem' }}>Enabled</span></td>
                    <td style={{ padding: '7px', color: '#16a34a' }}>● Active</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                    <td style={{ padding: '7px', fontWeight: 600 }}>Featherlite Workspace Solutions</td>
                    <td style={{ padding: '7px' }}><span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '8px', fontSize: '0.62rem' }}>Vendor</span></td>
                    <td style={{ padding: '7px' }}>sales@featherlitework.in</td>
                    <td style={{ padding: '7px' }}>9820045120</td>
                    <td style={{ padding: '7px' }}>Delhi</td>
                    <td style={{ padding: '7px' }}><span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '8px', fontSize: '0.62rem' }}>Enabled</span></td>
                    <td style={{ padding: '7px', color: '#16a34a' }}>● Active</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                    <td style={{ padding: '7px', fontWeight: 600 }}>Pepperfry B2B Distribution</td>
                    <td style={{ padding: '7px' }}><span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '8px', fontSize: '0.62rem' }}>Vendor</span></td>
                    <td style={{ padding: '7px' }}>b2b@pepperfrydist.in</td>
                    <td style={{ padding: '7px' }}>9871122334</td>
                    <td style={{ padding: '7px' }}>Gurgaon</td>
                    <td style={{ padding: '7px' }}><span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '8px', fontSize: '0.62rem' }}>Enabled</span></td>
                    <td style={{ padding: '7px', color: '#16a34a' }}>● Active</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Ultra-Smooth SaaS Vector Mouse Cursor Pointer */}
      <div
        style={{
          position: 'absolute',
          top: `${cursorPos.y}%`,
          left: `${cursorPos.x}%`,
          transform: `translate(0, 0) scale(${cursorClick ? 0.82 : 1})`,
          transition: 'top 0.85s cubic-bezier(0.22, 1, 0.36, 1), left 0.85s cubic-bezier(0.22, 1, 0.36, 1), transform 0.2s ease',
          pointerEvents: 'none',
          zIndex: 9999,
          filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.3))',
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 3L10.5 21L14.25 13.5L21.75 9.75L3 3Z"
            fill="#000080"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
