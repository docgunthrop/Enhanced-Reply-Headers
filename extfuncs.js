export {
	procFieldDataFuncs,
	procHeaderFieldData,
	fieldNameStyleBold,
	fieldNameStyleNone,
	createDateParts,
	getDateFormatString,
	createPrefsObj,
	isEmptyObj,
	rgb2Hex
};

String.prototype.capitalize = function() { return this[0].toUpperCase() + this.slice(1); };
String.prototype.trimStart2 = function(ch) { return this.slice([...this].findIndex(v => v !== ch)); };

function fieldFrom(n,{name,address}) {
	return [
		_ => name ? `${name} <${address}>` : address,// Thunderbird
		_ => name ? `${name} [mailto:${address}]` : address,// Outlook
		_ => address,
		_ => name || address
	][n]();
}

function fieldToCc(n,{name,address}) {
	return [
		_ => name ? `${name} <${address}>` : address,
		_ => address,
		_ => name || address
	][n]();
}

const procFieldDataFuncs = {
	from: ([name,address],i) => fieldFrom(i,{ name,address }),
	to: (arr,i) => arr.map(([name,address]) => fieldToCc(i,{ name,address })).join(", "),
	date: (date,dateOptions,i,prefsLocale) => getDateFormatString(i,date,dateOptions.locale||prefsLocale,dateOptions)
};
procFieldDataFuncs.cc = procFieldDataFuncs.to;

function procHeaderFieldData(prefData,headerFieldData,updateFieldsSet,dateOptions) {
	const {
		author,// [string,string]
		recipients,// [[string,string],...]
		ccList,// [[string,string],...]
		replyTo,// string
		date,// Date object
		subject// string
	} = headerFieldData;
	
	const fieldData = [
		[ "from", author, prefData.fieldFrom ],
		[ "to", recipients, prefData.fieldToCc ],
		[ "cc", ccList, prefData.fieldToCc ],
		[ "date", date, dateOptions, prefData.fieldDate, prefData.locale ]
	].reduce((tome,[field,...args]) => {
		tome[field] = !updateFieldsSet.has(field) && prefData.headerFieldValues[field] ||
		procFieldDataFuncs[field](...args);
		return tome;
	},{ replyto: replyTo, subject });
	
	return prefData.fieldOrder
	.slice(0,prefData.activeHeaderFieldCount)
	.map(field => [ prefData.fieldHeaderFieldNames[field],fieldData[field] ]);
}

function fieldNameStyleBold(name,data) {
	const fieldName = document.createElement("span");
	fieldName.style.fontWeight = "bold";
	fieldName.innerText = name + ": ";
	const fieldText = document.createTextNode(data);
	return [ fieldName,fieldText ];
}

function fieldNameStyleNone(name,data) { return [ document.createTextNode(`${name}: ${data}`) ]; }

function createDateParts(date,locale,options) {
	const [ weekday,,month,,day,,year,,hour,,minute,,second,,amPm,,timeZone ] = new Intl.DateTimeFormat(locale,options).formatToParts(date).map(e => e.value);
	return { weekday, month, day, year, hour, minute, second, amPm, timeZone };
}

function getDateFormatString(n,date,prefs,options,fieldDateCustom) {
	const { weekday, month, day, year, hour, minute, second, amPm, timeZone } = createDateParts(date,prefs.locale,options);
	const [ ampm,tz ] = options.hour12 ? [ amPm,timeZone ] : [ "",amPm ];
	const tzSuffix = tz === "GMT" ? tz + "+00:00" : tz;
	switch (n) {
		case 0:
			return `${weekday}, ${day} ${month} ${year} ${hour}:${minute}:${second}${ampm} ${tzSuffix}`;
		case 1:
			return `${weekday}, ${month} ${day}, ${year} ${hour}:${minute}:${second}${ampm} ${tzSuffix.slice(3,6)+tzSuffix.slice(7)}`;
		case 2:
			return `${year}-${month}-${day}T${hour}:${minute}:${second}${tz === "GMT" ? "Z" : tzSuffix.slice(3)}`;
		default:
			return parseCustomDate(date,fieldDateCustom,options.timeZone,prefs);
	}
}

function parseCustomDate(date,s,timeZone,prefs) {
	const locale = prefs && prefs.locale || navigator.language;
	const regx = /%([A-Z])([1-9]\d?)?%/gi;
	const tome = [...s.matchAll(regx)].reduce((x,[_,v,n]) => (x[v] = n && +n || 0,x),{});
	
	for (let v of [ "mM","yY","hH","aA","Zzt" ]) {
		if (Array.from(v).filter(k => tome.hasOwnProperty(k)).length > 1) {
			return "Invalid custom string; remove conflicting keys";
		}
	}
	if ([..."HaA"].filter(k => tome.hasOwnProperty(k)).length > 1) {
		return "Invalid custom string; cannot have both \"AM/PM\" field and 24-hour format";
	}
	
	const getPart = {
		d: n => n === 1 ? parts.day.trimStart2('0') : parts.day,
		D: n => n ? parts.weekday.slice(0,n) : parts.weekday,
		m: n => n === 1 ? parts.month.trimStart2('0') : parts.month,
		M: n => n ? parts.month.slice(0,n) : parts.month,
		y: _ => parts.year,
		Y: _ => parts.year,
		i: _ => parts.minute,
		s: _ => parts.second,
		H: _ => parts.hour,
		h: n => n === 1 ? parts.hour.trimStart2('0') : parts.hour,
		A: n => n ? parts.amPm.slice(0,n) : parts.amPm,
		a: n => (n ? parts.amPm.slice(0,n) : parts.amPm).toLowerCase(),
		z: _ => parts.timeZone,
		Z: _ => parts.timeZone,
		t: _ => parts.timeZone
	};
	
	const options = {
		weekday: "long",
		year: tome.hasOwnProperty("y") ? "2-digit" : "numeric",
		month: tome.hasOwnProperty("m") ? "2-digit" : "long",
		day: tome.d !== 1 ? "2-digit" : "numeric",
		hour12: !tome.hasOwnProperty("H"),
		hour: tome.h !== 1 ? "2-digit" : "numeric",
		minute: "numeric",
		second: "numeric",
		timeZone,
		timeZoneName: "longOffset"
	};
	
	[ ["z","short"],["Z","long"] ].forEach(([ch,tz]) => options.timeZoneName = tome.hasOwnProperty(ch) ? tz : options.timeZoneName);
	
	const parts = createDateParts(date,locale,options);
	if (!parts.timeZone) { [ parts.timeZone, parts.amPm ] = [ parts.amPm, "" ]; }
	return s.replace(regx,(ss,v) => getPart[v]?.(tome[v]) || ss);
}

function createPrefsObj(prefsData) {
	const prefs = Object.assign({},prefsData);
	prefs.locale = prefs.locale || navigator.language;
	prefs.fieldOrder = prefs.fieldOrder.slice();
	prefs.fieldHeaderFieldNames = Object.assign({},prefs.fieldHeaderFieldNames);
	prefs.headerFieldValues = prefs.fieldOrder.reduce((x,name) => Object.assign(x,{ [name]: "" }),{});
	
	prefs.dateTimeOptions = Object.assign(
		{ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
		prefs.dateTimeOptions,
		{
			weekday: prefs.fieldDateShortDay ? "short" : "long",
			month: prefs.fieldDateShortMonth ? "short" : "long",
			hour12: !prefs.fieldDate24Hour
		}
	);
	
	return prefs;
}

const isEmptyObj = obj => Object.getPrototypeOf(obj) === Object.prototype && !Object.keys(obj).length;

const rgb2Hex = rgb => rgb.slice(s.indexOf("(")+1,-1).split(",").map(v => Number(v).toString(16).padStart(2,'0')).join``;
