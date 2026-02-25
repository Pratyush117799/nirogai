/**
 * NirogAI — React Diabetes Screening Form
 * =========================================
 * File: frontend/src/pages/DiabetesScreen.jsx
 *
 * What this does:
 *   1. Shows the screening form to the user
 *   2. Sends data to Node.js backend (/api/screen/diabetes/predict)
 *   3. Displays the result (risk level, factors, recommendation)
 *
 * Your frontend is already built — use this as a reference
 * to connect your existing form to the backend API.
 */

import { useState } from "react";
import axios from "axios";

// Base URL of your Node.js backend
// In dev: http://localhost:5000
// In prod: set in .env as VITE_API_URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function DiabetesScreen() {
    // ── Form state ─────────────────────────────────────────────────────────────
    const [form, setForm] = useState({
        // Required fields
        BMI:          "",
        Age:          "",
        GenHlth:      "",
        PhysActivity: "0",
        // Optional fields
        HighBP:               "0",
        HighChol:             "0",
        Smoker:               "0",
        Stroke:               "0",
        HeartDiseaseorAttack: "0",
        HvyAlcoholConsump:    "0",
        mode:                 "screening"
    });

    const [result,  setResult]  = useState(null);
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState(null);

    // ── Handle input change ───────────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    // ── Submit form ───────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        // Convert all numeric strings to numbers before sending
        const payload = Object.fromEntries(
            Object.entries(form).map(([k, v]) => [
                k,
                k === 'mode' ? v : Number(v)
            ])
        );

        try {
            // Get JWT token from localStorage (set during login)
            const token = localStorage.getItem('nirogai_token');

            const response = await axios.post(
                `${API_URL}/api/screen/diabetes/predict`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type':  'application/json'
                    }
                }
            );

            setResult(response.data.result);

        } catch (err) {
            if (err.response?.status === 422) {
                setError("Invalid input — please check your values.");
            } else if (err.response?.status === 401) {
                setError("Please log in again.");
            } else {
                setError("Something went wrong. Please try again.");
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // ── Risk level colors ─────────────────────────────────────────────────────
    const riskColors = {
        low:    { bg: "bg-green-50",  border: "border-green-400", text: "text-green-700",  badge: "bg-green-100" },
        medium: { bg: "bg-yellow-50", border: "border-yellow-400",text: "text-yellow-700", badge: "bg-yellow-100" },
        high:   { bg: "bg-red-50",    border: "border-red-400",   text: "text-red-700",    badge: "bg-red-100" }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-2xl mx-auto p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Diabetes Screening</h1>
            <p className="text-gray-500 mb-6 text-sm">
                Fill in your health details. This takes less than 2 minutes.
            </p>

            {/* ── FORM ─────────────────────────────────────────────────────── */}
            <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl shadow">

                {/* BMI */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        BMI <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number" name="BMI" value={form.BMI}
                        onChange={handleChange} required min="10" max="80" step="0.1"
                        placeholder="e.g. 24.5"
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        BMI = weight(kg) ÷ height(m)²
                    </p>
                </div>

                {/* Age Category */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Age Group <span className="text-red-500">*</span>
                    </label>
                    <select name="Age" value={form.Age} onChange={handleChange} required
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                        <option value="">Select age group</option>
                        <option value="1">18–24</option>
                        <option value="2">25–29</option>
                        <option value="3">30–34</option>
                        <option value="4">35–39</option>
                        <option value="5">40–44</option>
                        <option value="6">45–49</option>
                        <option value="7">50–54</option>
                        <option value="8">55–59</option>
                        <option value="9">60–64</option>
                        <option value="10">65–69</option>
                        <option value="11">70–74</option>
                        <option value="12">75–79</option>
                        <option value="13">80+</option>
                    </select>
                </div>

                {/* General Health */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        General Health <span className="text-red-500">*</span>
                    </label>
                    <select name="GenHlth" value={form.GenHlth} onChange={handleChange} required
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                        <option value="">How would you rate your health?</option>
                        <option value="1">Excellent</option>
                        <option value="2">Very Good</option>
                        <option value="3">Good</option>
                        <option value="4">Fair</option>
                        <option value="5">Poor</option>
                    </select>
                </div>

                {/* Physical Activity */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Physical Activity <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                        {[["1", "Yes"], ["0", "No"]].map(([val, label]) => (
                            <label key={val} className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="PhysActivity" value={val}
                                    checked={form.PhysActivity === val} onChange={handleChange} />
                                <span className="text-sm">{label} — exercised in past 30 days</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Optional fields - toggle section */}
                <details className="border rounded-lg p-4">
                    <summary className="cursor-pointer text-sm font-medium text-blue-600">
                        + Add more details (improves accuracy)
                    </summary>
                    <div className="mt-4 space-y-3">
                        {[
                            ["HighBP",               "High Blood Pressure diagnosed?"],
                            ["HighChol",             "High Cholesterol diagnosed?"],
                            ["Smoker",               "Have you smoked 100+ cigarettes in your life?"],
                            ["Stroke",               "Ever had a stroke?"],
                            ["HeartDiseaseorAttack", "Heart disease or heart attack history?"],
                            ["HvyAlcoholConsump",    "Heavy alcohol consumption?"],
                        ].map(([field, label]) => (
                            <div key={field} className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">{label}</span>
                                <div className="flex gap-3">
                                    {[["1","Yes"],["0","No"]].map(([val, lbl]) => (
                                        <label key={val} className="flex items-center gap-1 cursor-pointer">
                                            <input type="radio" name={field} value={val}
                                                checked={form[field] === val} onChange={handleChange} />
                                            <span className="text-sm">{lbl}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </details>

                {/* Submit */}
                <button type="submit" disabled={loading}
                    className={`w-full py-3 rounded-lg font-semibold text-white transition
                        ${loading
                            ? "bg-blue-300 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 active:scale-95"
                        }`}>
                    {loading ? "Analysing..." : "Screen for Diabetes"}
                </button>

                {error && (
                    <p className="text-red-600 text-sm text-center mt-2">{error}</p>
                )}
            </form>

            {/* ── RESULT CARD ───────────────────────────────────────────────── */}
            {result && (() => {
                const colors = riskColors[result.risk_level] || riskColors.low;
                return (
                    <div className={`mt-6 p-6 rounded-xl border-2 ${colors.bg} ${colors.border}`}>
                        {/* Risk Header */}
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className={`text-xl font-bold ${colors.text}`}>
                                    {result.risk_level.toUpperCase()} RISK
                                </h2>
                                <p className="text-gray-600 text-sm mt-1">
                                    Diabetes Screening Result
                                </p>
                            </div>
                            <span className={`text-3xl font-bold ${colors.text}`}>
                                {result.risk_probability}%
                            </span>
                        </div>

                        {/* Risk Factors */}
                        <div className="mb-4">
                            <p className="text-sm font-semibold text-gray-700 mb-2">Risk Factors Detected:</p>
                            <div className="flex flex-wrap gap-2">
                                {result.key_factors.map((f, i) => (
                                    <span key={i}
                                        className={`text-xs px-2 py-1 rounded-full ${colors.badge} ${colors.text}`}>
                                        {f}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Recommendation */}
                        <div className="bg-white rounded-lg p-4 mb-4">
                            <p className="text-sm font-semibold text-gray-700 mb-1">Recommendation</p>
                            <p className="text-sm text-gray-600">{result.recommendation}</p>
                        </div>

                        {/* Disclaimer */}
                        <p className="text-xs text-gray-400 italic">{result.disclaimer}</p>
                    </div>
                );
            })()}
        </div>
    );
}
