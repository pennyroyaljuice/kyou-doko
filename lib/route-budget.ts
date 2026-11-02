// Reservations count both legs before a round trip starts. Unused return legs
// are released when an outbound route is unavailable or already over budget.
export class DirectionalRouteBudget {
  used=0;
  private held=0;
  readonly attempts=Array<number>(9).fill(0);
  constructor(readonly limit=24,private legs=1){}
  probe(){if(this.used+this.held>=this.limit)return false;this.used++;return true;}
  reserve(sector:number,pending:Iterable<number>,futureProbes=0){
    const others=new Set([...pending].filter(s=>s!==sector&&this.attempts[s]===0));
    const protectedCalls=others.size*this.legs+futureProbes;
    if(this.limit-this.used-this.held<protectedCalls+this.legs)return null;
    this.attempts[sector]++;this.held+=this.legs;let remaining=this.legs;
    return {
      leg:()=>{if(remaining<=0)throw new Error('Unreserved route call');remaining--;this.held--;this.used++;},
      close:()=>{this.held-=remaining;remaining=0;}
    };
  }
}
