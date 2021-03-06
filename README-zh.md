<div align="center">

[![Jigsaw-RPC](https://raw.githubusercontent.com/ZhyMC/jigsaw-rpc/master/logo.svg)](https://github.com/ZhyMc/jigsaw-rpc)

[English](https://github.com/ZhyMc/jigsaw-rpc/blob/master/README.md) | [中文](https://github.com/ZhyMc/jigsaw-rpc/blob/master/README-zh.md)

[![Build Status](https://www.travis-ci.org/ZhyMC/jigsaw-rpc.svg?branch=master)](https://www.travis-ci.org/ZhyMC/jigsaw-rpc)
[![codecov](https://codecov.io/gh/ZhyMC/jigsaw-rpc/branch/master/graph/badge.svg?token=MEXBYVKXAW)](https://app.codecov.io/gh/ZhyMC/jigsaw-rpc)
[![npm version](https://badge.fury.io/js/jigsaw-rpc.svg)](https://npmjs.org/package/jigsaw-rpc)

</div>

---

<br/>

## 简介

Jigsaw-RPC 是一个使用 TypeScript 编写的RPC（远程过程调用）框架, 完全使用 Node.js 的原生套接字API实现来确保远程调用的性能。

Jigsaw-RPC 的 API 十分便于使用和上手。

本项目具有较高的拓展性和可维护性，欢迎你的贡献。

## 安装

在一个 npm项目 的目录下，执行：
```
npm install jigsaw-rpc --save
```

## 快速上手的例子

serv.js
```
const { RPC } = require("jigsaw-rpc");
new RPC.registry.Server();

let jg = RPC.GetJigsaw({ name :"calculator" });

jg.port("add",({a,b})=>{
    return {
        msg:"Hello, World!",
        result:a + b,
        date:new Date().toString()
    }
});
```

app.js
```
const { RPC } = require("jigsaw-rpc");

let jg = RPC.GetJigsaw();
jg.on("ready", ()=>{
    
    jg.send("calculator:add",{ a:3, b:7 }).then((res)=>{
        console.log(res);
    })

})
```

然后同时运行这两个脚本，

就会得到这样的输出：
```
{
    msg: "Hello World!",
    result: 10,
    date:'--Now Date String--'
}
```

## 进阶的例子

```
const { RPC } = require("jigsaw-rpc");
new RPC.registry.Server();

let jg = RPC.GetJigsaw({ name : "calculator" });

jg.use(async (ctx,next)=>{

    if(ctx.method == "add"){
        ctx.calc = ( x , y )=>( x + y );
    }else if(ctx.method == "mul"){
        ctx.calc = ( x , y )=>( x * y );
    }else if(ctx.method == "sub"){
        ctx.calc = ( x , y )=>( x - y );
    }else if(ctx.method == "div"){
        ctx.calc = ( x , y )=>( x / y );
    }else 
        throw new Error("the calculator don't support this method");

    await next();
});

jg.use(async (ctx,next)=>{

    let { x , y } = ctx.data;
    ctx.result = ctx.calc( x , y );

    await next();
})


/* 
    下面的程序段可以在另一台计算机上作为单独的程序运行，

    或者可以和上面的程序成为同一个脚本文件来运行。
*/

let invoker = RPC.GetJigsaw();
invoker.on("ready",async ()=>{

    console.log(await invoker.send("calculator:add",{x:100,y:500}));
    //this will output 600;

    console.log(await invoker.send("calculator:mul",{x:100,y:500}));
    //this will output 50000;

    console.log(await invoker.send("calculator:sub",{x:100,y:500}));
    //this will output -400;

    console.log(await invoker.send("calculator:div",{x:100,y:500}));
    //this will output 0.2;

});


```

## 较好的性能


Jigsaw-RPC 完全使用Node.js的原生套接字API来实现。

> 一个单独的Jigsaw实例，每秒可以在一台x86架构、i5-8250、千兆网卡的局域网上，同时进行500次以上的请求调用，数据传输速度可以达到 10MB/s，并且延迟较低。 


## 简单的 API文档

### 1  RPC.GetJigsaw({ name , entry , registry }) : Jigsaw

> **jigsaw name** 是Jigsaw实例的名字，会和Jigsaw实例的网络地址一起同步到注册中心.


**name** 这个参数传入 **jigsaw name** ， 要创建的Jigsaw实例的名字

**entry** 是一个网络地址字符串，像这样："8.8.8.8:1234", 这个地址告诉别的Jigsaw怎么去访问你，会同步到注册中心上. 所以如果这个Jigsaw实例运行在互联网上，这个地址就一定要是一个互联网网络地址。

Jigsaw实例会监听你提供的端口，例如1234。如果你不想提供一个确定的端口，就直接传入 "127.0.0.1" 这样不带端口的网络地址字符串。

**registry** 是一个 **URL** ，描述 Jigsaw 域名注册中心 的网络地址. 格式像是这样 "jigsaw://127.0.0.1:3793/"

你可以这样创建一个域名注册中心：
```
new RPC.registry.Server(3793)
```

所以 GetJigsaw() 这个方法的调用格式就可以是这样的：

```
let jg = RPC.GetJigsaw("iamjigsaw","127.0.0.1","jigsaw://127.0.0.1:3793/")
```

所有选项参数都有默认值，所以如果你只像在本地网络创建Jigsaw实例的话，直接这样获取一个Jigsaw实例：

```
let jg = RPC.GetJigsaw()
```

设置一个默认的中间件， 当 RPC.GetJigsaw() 时，得到的新实例会自动调用 .use(middleware) 来注册该中间件。

### 2 RPC.registry.Server.prototype.constructor( bind_port ,bind_address? )

创建一个 Jigsaw 域名注册中心 服务器，在一群Jigsaw实例中，至少要存在一个域名注册中心服务器以供它们注册并共享自己的网络地址。

```
new RPC.registry.Server(3793)
```

### 3. Jigsaw


### 3.1 Jigsaw.prototype.send( path , data ) : Promise(object)

调用这个方法，会直接进行RPC远程调用，来调用一个远程的Jigsaw实例的某个方法。

其中这个 **path** 参数指的是调用路径，格式像是这样：

```
Jigsaw名:方法名
```

**data** 必须是一个 **可JSON序列化的JavaScript对象**，没有一个属性是undefined，或者一个函数的，或者其他特殊的类型的对象。

### 3.2 Jigsaw.prototype.port( method , handler )

> 事实上这个方法是 Jigsaw.prototype.use 的语法糖。调用这个方法，实际上是调用了一次use方法。


注册一个 Jigsaw 的 Port，来处理远程调用，

method 就是要处理的方法名，handler 是进行处理的函数，函数的返回值会返回给调用者。

如果 handler 内发生了异常，会把异常冒泡给调用者，调用者会收到该异常。

handler 可以是一个异步函数，如果你想的话。

```
...

const wait = require("util").promisify(setTimeout);

let jgA = RPC.GetJigsaw({name : "A"});
let jgB = RPC.GetJigsaw({name : "B"});

jgA.port("call",async ()=>{

    console.log("recv an invoke,start to wait...");
    await wait(3000);
    console.log("done!");

    return {hello:"world"};
})

jgB.send("A:call",{}).then(console.log);
```


> **data** 参数可以携带很大的数据，甚至可以大于1MB的数据量。

### 3.3 Jigsaw.prototype.use( handler )

这个方法会创建一个Jigsaw实例的中间件，来处理所有的调用请求。

一个 context 上下文对象，至少会有这些基础的属性：
```
{
    result: object, 
    /* if all middle-ware passed, the 'result' will send back to the invoker,
        'result' will be {} as the default value.
    */

    method: string , // the method name sender want to call
    data: any, // the data from sender
    sender: string, // sender's jigsaw name
    isJSON: boolean, // if the 'data' is JSON-object or Buffer
    rawdata: Buffer // the raw buffer of data
}
```

这个方法的用法像是：
```

let jg = RPC.GetJigsaw({ name:"serv" })

jg.use(async (ctx,next)=>{
    /*
        middle-ware codes here
    */

    await next();
})

```

### 3.4 Jigsaw.prototype.pre( handler )

这个方法会创建一个拦截远程调用请求的拦截器。

实际上这是一个 send() 方法的 pre 拦截钩子

这个方法的用法像是：

```

let jg = RPC.GetJigsaw({ name:"serv" })

jg.pre(async (ctx,next)=>{
    /*
        hook codes here
    */

    await next();
})

```

上下文 ctx 对象包含这些属性：

```
    raw:{ // raw object contains origin info.
        data : Buffer,
        pathstr : string,
        route : IRoute
    },

    data : Buffer, //hooked data, can modify this
    pathstr : string,  //hooked string of path to send, can modify this
    route : IRoute, //hooked route which implements IRoute interface, can modify this
```

如果你想自定义一个 route，实现这个接口：
```
interface IRoute{
    preload(): Promise<void>;
    getAddressInfo() : Promise<AddressInfo>;
}
```

这里有一个例子：

```
const { RPC } = require("../src/index");
new RPC.registry.Server();

let jg = RPC.GetJigsaw({ name : "user" });
let serv = RPC.GetJigsaw({ name: "serv" })

serv.port("get",()=>{
    return "serv you a cake";
})


jg.pre(async (ctx,next)=>{
    ctx.route = {
        preload(){

        },
        getAddressInfo(){
            let { port } = jg.getAddress();
            console.log("return a hacked address, all invoke will redirect to the jigsaw itself")
            return { address:"127.0.0.1", port };
        }
    }
    await next();
});

jg.port("get",()=>{
    return "hoo hoo your request are been redirect to here";
});


jg.on("ready",async ()=>{
    console.log(await jg.send("serv:get",{}));
})

```

### 3.5 Jigsaw.prototype.post( handler )

这个方法会创建一个在远程调用请求之后的拦截器。

事实上这是一个远程调用的post后钩子。

一个 post 上下文 context 对象包含这些属性：
```
{
    pathstr : string, // 远程调用的目标路径
    data : any, // 请求的数据 , Buffer 或者是 一个JS对象
    result : any, // 请求的返回数据, 这是可以被修改的 , Buffer、一个 JS 对象 或者是一个Error
}
```

### 3.6 Jigsaw.prototype.getAddress() : AddressInfo

这个方法会返回 jigsaw 内部套接字 所绑定的地址和端口。

### 3.7 Jigsaw.prototype.getName() : string

返回 jigsaw 的名字。

### 3.8 Jigsaw.prototype.getOption() : any

返回传递给 jigsaw 构造器的选项对象。



## 测试

这个工程使用 mocha测试框架，运行如下命令进行测试：
```
npm test
```

你也可以运行：
```
npm run test-cov
```
来检查测试用例的覆盖率。

## 证书

这个项目使用 MIT 的证书。

## 贡献

欢迎来自你的贡献💗，参照如下步骤提交Pull Request：

```
1. Fork 这个仓库
2. 修改代码，或者写一个 mocha测试用例
3. 使用 'cz-conventional-changelog' 这个规范提交 commit
4. 开启一个新的 Pull Request
```

或者针对问题提交一个ISSUE。
