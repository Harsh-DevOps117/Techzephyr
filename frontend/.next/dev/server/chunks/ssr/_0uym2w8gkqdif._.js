(()=>{"use strict";module.exports = [
"[project]/components/smart/auth-form.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthForm",
    ()=>AuthForm
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function AuthForm() {
    const [email, setEmail] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("admin@cit.local"), [password, setPassword] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("TechZephyr!2026"), [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(""), [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    async function submit(e) {
        e.preventDefault();
        setError("");
        setBusy(true);
        const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["api"])("/api/v1/auth/login", {
            method: "POST",
            body: JSON.stringify({
                email,
                password
            })
        });
        setBusy(false);
        if (!r.data) {
            setError(r.error ?? "Unable to sign in");
            return;
        }
        localStorage.setItem("tz_access_token", r.data.accessToken);
        localStorage.setItem("tz_refresh_token", r.data.refreshToken);
        localStorage.setItem("tz_role", r.data.role);
        router.replace("/");
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
        className: "auth",
        onSubmit: submit,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "eyebrow",
                children: "CIT SCHEDULING PLATFORM"
            }, void 0, false, {
                fileName: "[project]/components/smart/auth-form.tsx",
                lineNumber: 5,
                columnNumber: 750
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                children: "Welcome back."
            }, void 0, false, {
                fileName: "[project]/components/smart/auth-form.tsx",
                lineNumber: 5,
                columnNumber: 800
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                children: [
                    "Email",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        value: email,
                        onChange: (e)=>setEmail(e.target.value),
                        type: "email",
                        required: true
                    }, void 0, false, {
                        fileName: "[project]/components/smart/auth-form.tsx",
                        lineNumber: 5,
                        columnNumber: 834
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/smart/auth-form.tsx",
                lineNumber: 5,
                columnNumber: 822
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                children: [
                    "Password",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        value: password,
                        onChange: (e)=>setPassword(e.target.value),
                        type: "password",
                        required: true
                    }, void 0, false, {
                        fileName: "[project]/components/smart/auth-form.tsx",
                        lineNumber: 5,
                        columnNumber: 940
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/smart/auth-form.tsx",
                lineNumber: 5,
                columnNumber: 925
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "error",
                children: error
            }, void 0, false, {
                fileName: "[project]/components/smart/auth-form.tsx",
                lineNumber: 5,
                columnNumber: 1048
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                className: "primary",
                disabled: busy,
                children: [
                    busy ? "Signing in…" : "Sign in",
                    " ",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: "→"
                    }, void 0, false, {
                        fileName: "[project]/components/smart/auth-form.tsx",
                        lineNumber: 5,
                        columnNumber: 1156
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/smart/auth-form.tsx",
                lineNumber: 5,
                columnNumber: 1081
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/smart/auth-form.tsx",
        lineNumber: 5,
        columnNumber: 709
    }, this);
}
}),
"[project]/lib/api.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "api",
    ()=>api,
    "uuidv7",
    ()=>uuidv7
]);
const baseUrl = "/backend";
async function api(path, options = {}) {
    const token = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : null;
    let response;
    try {
        response = await fetch(`${baseUrl}${path}`, {
            ...options,
            headers: {
                "content-type": "application/json",
                ...("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : {},
                ...options.headers
            }
        });
    } catch  {
        return {
            error: "Cannot reach the API. Check that the backend is running and CORS allows this frontend."
        };
    }
    const body = await response.json().catch(()=>({}));
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return response.ok ? {
        data: body
    } : {
        error: body.message ?? "Request failed"
    };
}
function uuidv7() {
    const timestamp = Date.now().toString(16).padStart(12, "0");
    const random = ()=>Math.floor(Math.random() * 16).toString(16);
    const tail = Array.from({
        length: 19
    }, random).join("");
    return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7${tail.slice(0, 3)}-${[
        "8",
        "9",
        "a",
        "b"
    ][Math.floor(Math.random() * 4)]}${tail.slice(3, 6)}-${tail.slice(6, 18)}`;
}
}),
];})()

//# sourceMappingURL=_0uym2w8gkqdif._.js.map