import re,sys,os
HERE=os.path.dirname(os.path.abspath(__file__))
mods=["art","props16","house16","person16"]
out=["/* 16px 도트 키트 (proto/*.js를 묶은 것: 직접 고치지 말고 proto에서 고친 뒤 bundle_art.py로 다시 만든다) */","(function (root) {","\"use strict\";"]
for m in mods:
    s=open(os.path.join(HERE,f"{m}.js")).read()
    names=re.findall(r'^export (?:const|function|class|let) (\w+)',s,re.M)
    imps=re.findall(r'^import \{([^}]*)\} from "\./(\w+)\.js";\s*$',s,re.M)
    s=re.sub(r'^import [^\n]*\n','',s,flags=re.M)
    s=re.sub(r'^export (const|function|class|let) ',r'\1 ',s,flags=re.M)
    s=re.sub(r'^export \{[^}]*\};?\s*$','',s,flags=re.M)
    head="".join(f"  const {{{names_}}} = M_{mod};\n" for names_,mod in imps)
    out.append(f"const M_{m} = (() => {{\n{head}{s}\nreturn {{ {', '.join(names)} }};\n}})();")
out.append("root.Art16 = Object.assign({}, "+", ".join("M_"+m for m in mods)+");")
out.append('})(typeof window !== "undefined" ? window : globalThis);')
open(sys.argv[1],"w").write("\n".join(out)+"\n")
print("ok", sys.argv[1])
