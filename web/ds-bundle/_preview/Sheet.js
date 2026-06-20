var __dsPreview = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:import.meta.env>
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
    }
  });

  // ds-raw:__ds_raw__
  var require_ds_raw = __commonJS({
    "ds-raw:__ds_raw__"(exports, module) {
      init_define_import_meta_env();
      module.exports = window.RoomBookingUI;
    }
  });

  // shim:react-shim
  var require_react_shim = __commonJS({
    "shim:react-shim"(exports, module) {
      init_define_import_meta_env();
      var R = window.React;
      function jsx2(t, p, k) {
        return R.createElement(t, k === void 0 ? p : Object.assign({ key: k }, p));
      }
      module.exports = R;
      module.exports.jsx = jsx2;
      module.exports.jsxs = jsx2;
      module.exports.jsxDEV = jsx2;
      module.exports.Fragment = R.Fragment;
    }
  });

  // .design-sync/previews/Sheet.tsx
  var Sheet_exports = {};
  __export(Sheet_exports, {
    BookingPanel: () => BookingPanel
  });
  init_define_import_meta_env();

  // ds-shim:ds
  var ds_exports = {};
  __export(ds_exports, {
    default: () => ds_default
  });
  init_define_import_meta_env();
  __reExport(ds_exports, __toESM(require_ds_raw()));
  var g = window.RoomBookingUI;
  var ds_default = "default" in g ? g.default : g;

  // .design-sync/previews/Sheet.tsx
  var import_jsx_runtime = __toESM(require_react_shim(), 1);
  function BookingPanel() {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.Sheet, { open: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SheetTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Button, { variant: "outline", children: "Open Booking Panel" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.SheetContent, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.SheetHeader, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SheetTitle, { children: "Book Conference Room A" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.SheetDescription, { children: "Fill in the details below to request your booking." })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: "12px", padding: "16px 0" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: "6px" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Label, { htmlFor: "date", children: "Date" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Input, { id: "date", type: "date" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: "8px" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: "6px" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Label, { htmlFor: "start", children: "Start" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Input, { id: "start", type: "time", defaultValue: "09:00" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: "6px" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Label, { htmlFor: "end", children: "End" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Input, { id: "end", type: "time", defaultValue: "10:00" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(ds_exports.SheetFooter, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Button, { variant: "outline", style: { flex: 1 }, children: "Cancel" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ds_exports.Button, { style: { flex: 1 }, children: "Request Booking" })
        ] })
      ] })
    ] });
  }
  return __toCommonJS(Sheet_exports);
})();
