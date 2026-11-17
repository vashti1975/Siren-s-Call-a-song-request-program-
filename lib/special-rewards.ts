export type SpecialReward={id:string;title:string;category:"Chibis";cost:number;description:string;artwork:string};
export const specialRewards:SpecialReward[]=[
 {id:"special:fat-cat",title:"Little Friend",category:"Chibis",cost:5,description:"A friendly FFXIV chibi for your page.",artwork:"/default-chibi.png"},
 {id:"special:moogle",title:"Bard Buddy",category:"Chibis",cost:5,description:"A little companion for your next performance.",artwork:"/default-chibi.png"},
 {id:"special:carbuncle",title:"Encore Friend",category:"Chibis",cost:5,description:"Celebrate another song with a chibi sticker.",artwork:"/default-chibi.png"},
 {id:"special:collection",title:"Special Encore",category:"Chibis",cost:20,description:"A bonus collectible chibi reward.",artwork:"/default-chibi.png"},
];
export const specialReward=(id:string)=>specialRewards.find(reward=>reward.id===id);
