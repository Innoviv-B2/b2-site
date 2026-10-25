(function(){var t,d=document,r=d.documentElement;try{t=localStorage.getItem("b2-theme")}catch(e){}
if(t!=="light"&&t!=="dark")t=window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";
r.setAttribute("data-theme",t);var m=d.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="light"?"#F4F3F7":"#0F0E13")})();
