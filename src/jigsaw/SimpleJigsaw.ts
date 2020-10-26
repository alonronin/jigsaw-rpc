import DomainClient = require("../network/domain/client/DomainClient");
import IJigsaw = require("./IJigsaw");
import PacketFactory = require("../network/protocol/factory/PacketFactory");
import PacketBuilderManager = require("../network/protocol/builder/manager/PacketBuilderManager");
import UDPSocket = require("../network/socket/UDPSocket");
import BuilderNetworkClient = require("../network/BuilderNetworkClient");
import NetPacketRouter = require("../network/request/packetrouter/NetPacketRouter");
import AddressInfo = require("../network/domain/AddressInfo");
import InvokeRequest = require("../network/request/InvokeRequest");
import Path = require("../network/request/Path");
import SimplePacketRouter = require("../network/request/packetrouter/SimplePacketRouter");
import InvokeHandler = require("../network/handler/InvokeHandler");
import Crypto = require("crypto");
import DataValidator = require("./DataValidator");
import Url = require("url");
import { TypedEmitter } from "tiny-typed-emitter";


interface JigsawEvent{
    ready:()=>void;
    close:()=>void;
}

type HandlerRet = Promise<object> | Promise<void>  | object | void;
type Handler = (data : object) => HandlerRet;
type FinalHandler = (port_name:string,data:object)=> object | void;

class SimpleJigsaw extends TypedEmitter<JigsawEvent> implements IJigsaw{
    private state = "close";

    public jgname : string;
    private domclient : DomainClient;
    
    private entry_address : string;
    private entry_port? : number;
    
    private registry_path : Url.Url;

    private netrouter : NetPacketRouter;
    private router : SimplePacketRouter;
    private request_seq : number = 0;
    private port_handlers : Map<string,Handler> = new Map();
    private invoke_handler : InvokeHandler;
    private final_handler : FinalHandler = ()=>{};
    private module_ref = new Set<string>();
    private socket : UDPSocket;

    constructor(jgname:string,entry_address:string,entry_port:number | undefined,registry_path:Url.Url){
        super();

        if(!registry_path.hostname)
            throw new Error("regsitry_path.hostname must be specified");
        if(!registry_path.port)
            throw new Error("regsitry_path.port must be specified");

        this.jgname = jgname;
        this.entry_address = entry_address;
        this.entry_port = entry_port;

        this.registry_path = registry_path;

        let factory = new PacketFactory();
        let builder_manager = new PacketBuilderManager(factory);
        let socket = new UDPSocket(this.entry_port,"0.0.0.0");
        this.socket = socket;
        
        let client=new BuilderNetworkClient(socket,factory,builder_manager);
        this.netrouter = new NetPacketRouter(client);

        let registry_addr = this.registry_path.hostname as string;
        let registry_port = parseInt(this.registry_path.port as string) || 3793;
        this.domclient = new DomainClient(this.jgname,this.entry_address,
             new AddressInfo(registry_addr,registry_port)
        ,this.netrouter);

        this.router = new SimplePacketRouter(client,this.domclient);

        this.invoke_handler = new InvokeHandler(this.netrouter,this.handleInvoke.bind(this));

        this.router.on("close",()=>{
            this.setModuleClose("router");
            this.close();
        });
        this.domclient.on("close",()=>{
            this.setModuleClose("domclient");
            this.close();
        });
        this.router.on("ready",()=>{
            this.setModuleReady("router");
        });
        this.domclient.on("ready",()=>{
            this.setModuleReady("domclient");
        });
    }
    private setModuleReady(name:string){
        if(this.state != "close")
            throw new Error("not a correct state");

        this.module_ref.add(name);

        if(this.module_ref.size == 2){
            this.state="ready";
            this.emit("ready");
        }
    }
    private setModuleClose(name:string){
        if(this.state != "closing")
            throw new Error("not at closing state, but module closed");
        
        this.module_ref.delete(name);
        
        if(this.module_ref.size == 0){
            this.state = "close";
            this.emit("close");
        }

    }
    private async handleInvoke(path:Path,data : Buffer) : Promise<Buffer>{
        let req_data = JSON.parse(data.toString());

        let port_handler = this.port_handlers.get(path.method) as Handler;
        
        let ret_data;
        if(!this.port_handlers.has(path.method)){
            ret_data = await this.final_handler(path.method,req_data);
        }else{
            ret_data = await port_handler(req_data);
        }

        if(!ret_data)
            ret_data = {};
        
        return Buffer.from(JSON.stringify(ret_data as object));
    }
    static getRandomName(){
        let hash = Crypto.createHash("md5");
        hash.update(Math.random()+"");
        return `rand-${hash.digest("hex").substr(0,8)}`;
    }
    async close(){
        if(this.state == "closing" || this.state == "close")
            return;
        if(this.state != "ready")
            throw new Error("at this state, the jigsaw can not be closed");

        this.state = "closing";
        
        //this.router.close();
        await this.domclient.close();   
        
        this.socket.close();

    }
    
    send(path_str:string,data:object) : Promise<object>{
        let validator = new DataValidator(data);
        validator.validate();

        let path = Path.fromString(path_str);
        return this.doSend(path,data);
    }
    private async doSend(path:Path,data:object){
        let req_seq = this.request_seq++;
        
        let buffer = Buffer.from(JSON.stringify(data));
        let request = new InvokeRequest(this.jgname,path,buffer,this.router,req_seq);

        await request.whenBuild();
        await request.run();
        let ret_buf = request.getResult();

        return JSON.parse(ret_buf.toString());

    }
    port(port_name:string,handler:Handler) : void{
        if(this.port_handlers.has(port_name))
            throw new Error("this port has already binded");

        this.port_handlers.set(port_name,handler);
    }
    unport(port_name:string){
        if(!this.port_handlers.has(port_name))
            throw new Error("this port hasn't been binded");

        this.port_handlers.delete(port_name);
    }
    handle(finalhandler:FinalHandler) : void{
        this.final_handler = finalhandler;

    }

}

export = SimpleJigsaw;