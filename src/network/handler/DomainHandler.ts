import NetPacketRouter = require("../request/packetrouter/NetPacketRouter");
import AbstractHandler = require("./AbstractHandler");
import Packet = require("../protocol/Packet");
import DomainReplyPacket = require("../protocol/packet/DomainReplyPacket");
import DomainQueryPacket = require("../protocol/packet/DomainQueryPacket");
import DomainStorage = require("../domain/server/DomainStorage");
import DomainUpdatePacket = require("../protocol/packet/DomainUpdatePacket");
import ErrorPacket = require("../protocol/packet/ErrorPacket");


class DomainHandler extends AbstractHandler{
    public storage : DomainStorage;
    public router : NetPacketRouter;

    constructor(router:NetPacketRouter){
        super(router);
        this.router = router;

        this.storage = new DomainStorage();
        this.router.plug("DomainQueryPacket",this.handlePacket.bind(this));
        this.router.plug("DomainUpdatePacket",this.handlePacket.bind(this));
        
    }
    protected onPacket(p:Packet):void{
        if(p.getName() == "DomainQueryPacket"){
            let pk = p as DomainQueryPacket;

            let r_pk = new DomainReplyPacket();
            let addr = this.storage.getAddress(pk.jgname);
            r_pk.address = addr.address;
            r_pk.port = addr.port;
            r_pk.request_id=pk.request_id;
            
            this.router.sendPacket(r_pk,pk.reply_info.port,pk.reply_info.address);    

        }else if(p.getName() == "DomainUpdatePacket"){
            let pk = p as DomainUpdatePacket;
            this.storage.setAddress(pk.jgname,pk.addrinfo);
        

        }else
            throw new Error("recv an unknown packet");

    }
    protected handlePacket(p:Packet):void{
        try{
            this.onPacket(p);
        }catch(err){
            let pk=new ErrorPacket();
            pk.error = err;
            this.router.sendPacket(pk,p.reply_info.port,p.reply_info.address);
        }

    }

}

export = DomainHandler;