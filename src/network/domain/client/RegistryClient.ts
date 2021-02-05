import AddressInfo from "../AddressInfo";
import IRegistryClient,{ RegistryClientEvent } from "./IRegistryClient";
import IRouter from "../../router/IRouter";
import LifeCycle from "../../../utils/LifeCycle";
import DomainClientHandler from "../../../network/handler/DomainClientHandler";
import RegistryServerInfo from "../RegistryServerInfo";
import RegistryResolver from "./RegistryResolver";
import RegistryUpdater from "./RegistryUpdater";
import { TypedEmitter } from "tiny-typed-emitter";




class RegistryClient extends TypedEmitter<RegistryClientEvent> implements IRegistryClient{
    private router : IRouter;
    private client_id : string;
    private client_name : string;
    private updater : RegistryUpdater;
    private resolver : RegistryResolver;

    private handler : DomainClientHandler;
    private lifeCycle = new LifeCycle();

    constructor(
        client_id:string,
        client_name:string,
        entry:AddressInfo,
        server_address:RegistryServerInfo,
        router:IRouter){
        super();

        this.router = router;
        this.client_id = client_id;
        this.client_name = client_name;


        this.updater = new RegistryUpdater(this.client_id,this.client_name,entry,server_address,this.router);
        this.updater.on("error",(err)=>this.emit("error",err));

        this.resolver = new RegistryResolver(server_address,this.router);

        this.handler = new DomainClientHandler(this.router);


        this.lifeCycle.setState("starting");

        this.handler.getEventEmitter().on("domain_purged",this.handlePurgedEvent.bind(this));
        this.router.getLifeCycle().when("ready").then(this.start.bind(this));
        
    }
    public resolveAny(regpath : string,timeout:number = 5000){
        return this.resolver.resolveAny(regpath,timeout);
    }
    public resolve(regpath : string,timeout:number = 5000){
        return this.resolver.resolve(regpath,timeout);
    }
    public getLifeCycle(){
        return this.lifeCycle;
    }
    private handlePurgedEvent(jgid:string){
        this.resolver.getCache().clearCached_jgid(jgid);
        
    }
    private start(){
        this.updater.start();
        this.lifeCycle.setState("ready");
    }
    async close(){
        if(this.lifeCycle.getState() == "closing" || this.lifeCycle.getState() =="closed")
            return;
        if(this.lifeCycle.getState() != "ready")
            throw new Error("at this state, instance can not close");
        

        this.lifeCycle.setState("closing");

        await this.updater.purgeDomain();
        await this.handler.close();

        await this.updater.close();

        await this.resolver.close();

        this.lifeCycle.setState("closed");
    }

}

export default RegistryClient;
