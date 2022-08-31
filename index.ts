#!/usr/bin/env node

import fs from 'fs';
import rl from 'readline'; 
const readline = rl.createInterface({
    input: process.stdin,
    output: process.stdout
});

let argv = process.argv
argv = argv.slice(argv.indexOf(process.cwd())+1);

let fl: string = fs.readFileSync(argv[0], "utf8")

let macros: {name: string, value: number | string}[] = []
let sections: {name: string, line: number}[] = []

fl.match(/\.\w+ ?.*/gm)?.forEach((match: string) => {
    if (match.startsWith('.define')) {
        let t = match.split(" ")
        macros.push({name: t[1], value: t[2]})
        fl = fl.replace(match, "");
    } else if (match.startsWith('.section')) {
        let t = match.split(" ")
        let p = fl.replace(/\-\-[^\n]*\n/g, "").replace(/[\r\n]/g, "").split(";")
        sections.push({name: t[1], line: p.indexOf(p.find((s: string) => s.startsWith(match)) ?? "") + (sections.length !== 0 ? 1 : 0)})
        if (sections.length === 1)
        fl = fl.replace(match, "");
        else fl = fl.replace(match, "end;");
    }
})

let file: string[] = fl.replace(/\-\-[^\n]*\n/g, "").replace(/[\n\r]/g, "").split(";")

let variables: {name: string, value: string | number}[] = []

function splitTok(val: string) {
    val = val.replace(/^\s+|\s+$/g, '');
    let instring = false;
    let escaped = false;
    let tok = ""
    let out = []
    for (let i = 0; i < val.length; i++) {
        let char = val[i];
        if (char === ' ' && !instring) {
            if (macros.map(mac => mac.name).includes(tok))  {
                out.push(macros.find(mac => mac.name === tok)?.value)
            } else {
                out.push(tok)
            }
            
            tok = ""
        } else if (char === '\\' && !escaped) {
            escaped = true;
        } else if (escaped) {
            if (char === 'n') tok += '\n'
            else if (char === 'r') tok += '\r'
            else if (char === 't') tok += '\t'
            else tok += char;
            escaped = false
        } else if (char === '"') {
            instring = !instring;
            tok += char;
        } else {
            tok += char;
        }
    }
    if (macros.map(mac => mac.name).includes(tok))  {
        out.push(macros.find(mac => mac.name === tok)?.value)
    } else {
        out.push(tok)
    }

    return out;
}

function parseType(val: any) {
    if (isNum(val)) {
        return parseFloat(val)
    } else if (val.startsWith('"') && val.endsWith('"')) {
        return val.slice(1, -1);
    } else {
        return variables.find(e => e.name === val)?.value;
    }
}
/**
 * isNum?
 * @param {string} val 
 */
function isNum(val: string) {
    for (var i = 0; i < val.length; i++) {
        if (['0','1','2','3','4','5','6','7','8','9'].includes(val.charAt(0))) {

        } else {
            return false;
        }
    }
    return true;
}

function readLineSync(m: string) {
    return new Promise(resolve => {
        readline.question(m, (ans) => {
            resolve(ans)
        })
    });
}

function throwError(msg: string) {
    
}

let stack: (number | string)[] = [];
let callstack: {} = [];
async function main() {
    for (let i = 0; i < file.length; i++) {
        var ins = splitTok(file[i])
        if (ins[0] === ("let")) {
            if (ins.length < 4) 
            variables.push({name: ins[1]?.toString() ?? "", value: parseType(ins[3] ?? "")})
        } else if (ins[0] === ("set")) {
            variables.find(e => e.name === ins[1])!.value = parseType(ins[3])
        } else if (ins[0] === 'output') {
            process.stdout.write(parseType(ins[1]).toString())
        } else if (ins[0] === 'push') {
            stack.push(parseType(ins[1]))
        } else if (ins[0] === 'pop') {
            variables.find(e => e.name === ins[1])!.value = stack.pop() ?? ""
        } else if (ins[0] === 'mul') {
            let o = stack.pop();
            let t = stack.pop();
            stack.push(o*t)
        } else if (ins[0] === 'div') {
            let o = stack.pop();
            let t = stack.pop();
            stack.push(o/t)
        } else if (ins[0] === 'add') {
            let o = stack.pop();
            let t = stack.pop();
            stack.push(o+t)
        } else if (ins[0] === 'sub') {
            let o = stack.pop();
            let t = stack.pop();
            stack.push(o-t);
        } else if (ins[0] === 'mod') {
            let o = stack.pop();
            let t = stack.pop();
            stack.push(o%t);
        } else if (ins[0] === 'jmp') {
            let jmpto = ins[1];
            callstack.push(i)
            i = sections.find(sec => sec.name === jmpto).line - 1
            continue;
        } else if (ins[0] === 'ifjmp') {
            let jmpto = ins[1];
            let condition = stack.pop();
            if (condition === 1) {
                i = sections.find(sec => sec.name === jmpto).line - 1;
                continue;
            }
            
        } else if (ins[0] === 'if') {
            let condition = stack.pop();
            if (condition === 1) {
                continue;
            } else {i++; continue;}
        } else if (ins[0] === 'ret') {
            i = callstack.pop();
            continue;
        } else if (ins[0] === 'end') {
            break;
        } else if (ins[0] === 'equ') {
            let o = stack.pop();
            let t = stack.pop();
            stack.push(o===t);
        } else if (ins[0] === 'greater') {
            let o = stack.pop();
            let t = stack.pop();
            stack.push((o>t) ? 1 : 0);
        } else if (ins[0] === 'lesser') {
            let o = stack.pop();
            let t = stack.pop();
            stack.push((o<t) ? 1 : 0);
        } else if (ins[0] === 'grequ') {
            let o = stack.pop();
            let t = stack.pop();
            stack.push((o>=t) ? 1 : 0);
        } else if (ins[0] === 'lsequ') {
            let o = stack.pop();
            let t = stack.pop();
            stack.push((o<=t) ? 1 : 0);
        } else if (ins[0] === 'input') {
            let t = await readLineSync(parseType(ins[1]))
            stack.push(t)
        } else if (ins[0] === 'tonum') {
            stack.push(parseInt(stack.pop()))
        } else if (ins[0] === 'tostr') {
            stack.push((stack.pop().toString()))
        }
        // string builtins
        else if (ins[0] === 'strsplit') {
            let str = stack.pop().toString()
            for (var i = str.length-1; i >= 0; i--) {
                stack.push(str[i])
            }
            stack.push(str.length)
        }
        //console.log(stack, callstack, i)
    }

    readline.close()
}

main()
