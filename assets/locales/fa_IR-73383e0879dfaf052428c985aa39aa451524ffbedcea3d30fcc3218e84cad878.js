/*global I18n:true */

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default pluralization rule
I18n.pluralizationRules = {
  en: function(n) {
    return n === 0 ? ["zero", "none", "other"] : n === 1 ? "one" : "other";
  }
};

// Set current locale to null
I18n.locale = null;
I18n.fallbackLocale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.SEPARATOR = ".";

I18n.noFallbacks = false;

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  options = options || {};

  var translations = this.prepareOptions(I18n.translations),
    locale = options.locale || I18n.currentLocale(),
    messages = translations[locale] || {},
    currentScope;

  options = this.prepareOptions(options);

  if (typeof scope === "object") {
    scope = scope.join(this.SEPARATOR);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.SEPARATOR + scope;
  }

  var originalScope = scope;
  scope = scope.split(this.SEPARATOR);

  if (scope.length > 0 && scope[0] !== "js") {
    scope.unshift("js");
  }

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (messages === undefined && this.extras && this.extras[locale]) {
    messages = this.extras[locale];
    scope = originalScope.split(this.SEPARATOR);

    while (messages && scope.length > 0) {
      currentScope = scope.shift();
      messages = messages[currentScope];
    }
  }

  if (messages === undefined) {
    messages = options.defaultValue;
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {},
    opts,
    count = arguments.length;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);

  var matches = message.match(this.PLACEHOLDER),
    placeholder,
    value,
    name;

  if (!matches) {
    return message;
  }

  for (var i = 0; (placeholder = matches[i]); i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    if (typeof options[name] === "string") {
      // The dollar sign (`$`) is a special replace pattern, and `$&` inserts
      // the matched string. Thus dollars signs need to be escaped with the
      // special pattern `$$`, which inserts a single `$`.
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
      value = options[name].replace(/\$/g, "$$$$");
    } else {
      value = options[name];
    }

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(
      placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}")
    );
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  options.needsPluralization = typeof options.count === "number";
  options.ignoreMissing = !this.noFallbacks;

  var translation = this.findTranslation(scope, options);

  if (!this.noFallbacks) {
    if (!translation && this.fallbackLocale) {
      options.locale = this.fallbackLocale;
      translation = this.findTranslation(scope, options);
    }

    options.ignoreMissing = false;

    if (!translation && this.currentLocale() !== this.defaultLocale) {
      options.locale = this.defaultLocale;
      translation = this.findTranslation(scope, options);
    }

    if (!translation && this.currentLocale() !== "en") {
      options.locale = "en";
      translation = this.findTranslation(scope, options);
    }
  }

  try {
    return this.interpolate(translation, options);
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.findTranslation = function(scope, options) {
  var translation = this.lookup(scope, options);

  if (translation && options.needsPluralization) {
    translation = this.pluralize(translation, scope, options);
  }

  return translation;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(options, this.lookup("number.format"), {
    precision: 3,
    separator: this.SEPARATOR,
    delimiter: ",",
    strip_insignificant_zeros: false
  });

  var negative = number < 0,
    string = Math.abs(number)
      .toFixed(options.precision)
      .toString(),
    parts = string.split(this.SEPARATOR),
    precision,
    buffer = [],
    formattedNumber;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length - 3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
      separator: new RegExp(options.separator.replace(/\./, "\\.") + "$"),
      zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "");
  }

  return formattedNumber;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024,
    size = number,
    iterations = 0,
    unit,
    precision;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", { count: size });
    precision = 0;
  } else {
    unit = this.t(
      "number.human.storage_units.units." +
        [null, "kb", "mb", "gb", "tb"][iterations]
    );
    precision = size - Math.floor(size) === 0 ? 0 : 1;
  }

  options = this.prepareOptions(options, {
    precision: precision,
    format: "%n%u",
    delimiter: ""
  });

  number = this.toNumber(size, options);
  number = options.format.replace("%u", unit).replace("%n", number);

  return number;
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(translation, scope, options) {
  if (typeof translation !== "object") return translation;

  options = this.prepareOptions(options);
  var count = options.count.toString();

  var pluralizer = this.pluralizer(options.locale || this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = typeof key === "object" && key instanceof Array ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);

  if (message !== null || options.ignoreMissing) {
    return message;
  }

  return this.missingTranslation(scope, keys[0]);
};

I18n.missingTranslation = function(scope, key) {
  var message = "[" + this.currentLocale() + this.SEPARATOR + scope;
  if (key) {
    message += this.SEPARATOR + key;
  }
  return message + "]";
};

I18n.currentLocale = function() {
  return I18n.locale || I18n.defaultLocale;
};

I18n.enableVerboseLocalization = function() {
  var counter = 0;
  var keys = {};
  var t = I18n.t;

  I18n.noFallbacks = true;

  I18n.t = I18n.translate = function(scope, value) {
    var current = keys[scope];
    if (!current) {
      current = keys[scope] = ++counter;
      var message = "Translation #" + current + ": " + scope;
      if (!_.isEmpty(value)) {
        message += ", parameters: " + JSON.stringify(value);
      }
      // eslint-disable-next-line no-console
      console.info(message);
    }
    return t.apply(I18n, [scope, value]) + " (#" + current + ")";
  };
};

I18n.enableVerboseLocalizationSession = function() {
  sessionStorage.setItem("verbose_localization", "true");
  I18n.enableVerboseLocalization();

  return "Verbose localization is enabled. Close the browser tab to turn it off. Reload the page to see the translation keys.";
};

// shortcuts
I18n.t = I18n.translate;


MessageFormat = {locale: {}};
I18n._compiledMFs = {"logs_error_rate_notice.reached_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> به حد مجاز از ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " رسیده است.";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> به حد مجاز از ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " رسیده است.";
return r;
}, "logs_error_rate_notice.exceeded_hour_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> از حد مجاز از ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " عبور کرده است.";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b> – <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["url"];
r += "' target='_blank'>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "rate";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a> از حد مجاز از ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "limit";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " error/hour";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/hour";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " عبور کرده است.";
return r;
}, "topic.read_more_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>یک پیام خوانده نشده</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/unread'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " پیام خوانده نشده</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "و ";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>1 موضوع جدید</a> ";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "و ";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["basePath"];
r += "/new'>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " موضوع جدید</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " وجود دارد, یا ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "نمایش سایر موضوعات دسته‌بندی ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
return r;
}, "flagging.delete_confirm_MF" : function(d){
var r = "";
r += "شما در حال حذف ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> نوشته";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> نوشته";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " و ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> موضوع";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> موضوع";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " از این کاربر هستید، حذف حساب کاربری و جلوگیری از ثبت نام با آیپی <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> و ایمیل <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> که به لیست دائمی سیاه منتقل می‌شوند. ادامه می‌دهید؟";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "این موضوع دارای ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 پاسخ";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " پاسخ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " است ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "و مورد پسند دیگران واقع شده است";
return r;
},
"med" : function(d){
var r = "";
r += "و بسیار مورد پسند دیگران واقع شده است";
return r;
},
"high" : function(d){
var r = "";
r += "و به شدت مورد پسند دیگران واقع شده است";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += "\n";
return r;
}, "admin.user.delete_all_posts_confirm_MF" : function(d){
var r = "";
r += "شما در حال حذف ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 نوشته";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " نوشته";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " and ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 نوشته";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " موضوع";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " هستید. ادامه می‌دهید؟";
return r;
}, "too_few_topics_and_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "和";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_topics_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "共有 <strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredTopics";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个主题";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "too_few_posts_notice_MF" : function(d){
var r = "";
r += "让我们<a href=\"https://blog.discourse.org/2014/08/building-a-discourse-community/\">开始讨论吧！</a>现 ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "currentPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "仅有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "共有<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。访客需要更多的阅读和回复——我们建议至少";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "requiredPosts";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
},
"other" : function(d){
var r = "";
r += "<strong>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</strong>个帖子";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["fa_IR"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}};
MessageFormat.locale.fa_IR = function ( n ) {
  return "other";
};

(function() {

  I18n.messageFormat = function(key, options) {
    var fn = I18n._compiledMFs[key];
    if (fn) {
      try {
        return fn(options);
      } catch(err) {
        return err.message;
      }
    } else {
      return 'Missing Key: ' + key;
    }
    return I18n._compiledMFs[key](options);
  };

})();

I18n.translations = {"fa_IR":{"js":{"number":{"format":{"separator":".","delimiter":"،"},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"بایت","other":"بایت"},"gb":"گیگابایت","kb":"کیلوبایت","mb":"مگابایت","tb":"ترابایت"}}},"short":{"thousands":"{{number}} هزار","millions":"{{number}} میلیون"}},"dates":{"time":"HH:mm","time_with_zone":"HH:mm (z)","time_short_day":"ddd, HH:mm","timeline_date":"MMM YYYY","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} پیش","tiny":{"half_a_minute":"1 دقیقه پیش","less_than_x_seconds":{"one":"\u003c %{count} ثانیه","other":"%{count} ثانیه پیش"},"x_seconds":{"one":"%{count} ثانیه","other":"%{count} ثانیه"},"less_than_x_minutes":{"one":"\u003c %{count} دقیقه","other":"%{count} دقیقه پیش"},"x_minutes":{"one":"%{count} دقیقه","other":"%{count} دقیقه"},"about_x_hours":{"one":"%{count} ساعت","other":"%{count} ساعت"},"x_days":{"one":"%{count} روز","other":"%{count} روز"},"x_months":{"one":"%{count} ماه","other":"%{count} ماه"},"about_x_years":{"one":"%{count} سال","other":"%{count} سال"},"over_x_years":{"one":"\u003e %{count} سال","other":"\u003e %{count} سال"},"almost_x_years":{"one":"%{count} سال","other":"%{count} سال"},"date_month":"D MMM","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} دقیقه","other":"%{count} دقیقه"},"x_hours":{"one":"%{count} ساعت","other":"%{count} ساعت"},"x_days":{"one":"%{count} روز","other":"%{count} روز"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"%{count} دقیقه پیش","other":"%{count} دقیقه پیش"},"x_hours":{"one":"%{count} ساعت پیش","other":"%{count} ساعت پیش"},"x_days":{"one":"%{count} روز پیش","other":"%{count} روز پیش"},"x_months":{"one":"%{count} ماه قبل","other":"%{count} ماه‌های قبل"},"x_years":{"one":"%{count} سال قبل","other":"%{count} سال قبل"}},"later":{"x_days":{"one":"%{count} روز بعد","other":"%{count} روز بعد"},"x_months":{"one":"%{count} ماه بعد","other":"%{count} ماه بعد"},"x_years":{"one":"%{count} سال بعد","other":"%{count} سال بعد"}},"previous_month":"ماه قبل","next_month":"ماه بعد","placeholder":"تاریخ"},"share":{"topic_html":"موضوع: \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"ارسال #%{postNumber}","close":"بسته","twitter":"این پیوند را در توییتر به اشتراک بگذارید","facebook":"این پیوند را در فیسبوک به اشتراک بگذارید","email":"این پیوند را با ایمیل بفرستید"},"action_codes":{"public_topic":"این موضوع در %{when} عمومی شده","private_topic":"این موضوع در %{when} یک پیغام خصوصی شده","split_topic":"این موضوع %{when} جدا شد ","invited_user":"%{who} در %{when} دعوت شده","invited_group":"%{who} در %{when} دعوت شده","user_left":"%{who}%{when} خود را از این پیغام حذف کرد.","removed_user":"%{who} در %{when} حذف شد","removed_group":"%{who} در %{when} حذف شد","autobumped":"این مطلب %{when} به صدر مطالب آورده شد.","autoclosed":{"enabled":"در %{when} بسته شد","disabled":"در %{when} باز شد "},"closed":{"enabled":"در %{when} بسته شد","disabled":"در %{when} باز شد"},"archived":{"enabled":"در %{when} بایگانی شد","disabled":"در %{when} از بایگانی درآمد"},"pinned":{"enabled":"در %{when} سنجاق شد","disabled":"در %{when} سنجاق برداشته شد"},"pinned_globally":{"enabled":"در %{when} به صورت سراسری سنجاق شد","disabled":"در %{when} سنجاق برداشته شد"},"visible":{"enabled":"در %{when} وارد فهرست شد","disabled":"در %{when} از فهرست پاک شد"},"banner":{"enabled":"این در %{when} یک بنر شد، تا زمانی که کاربر آن را ببندد بالای صفحه خواهد ماند.","disabled":"این بنر در %{when} حذف شده. و دیگر در بالای صفحات نمایش داده نمی‌شود."},"forwarded":"ایمیل بالا را ارسال کرد"},"topic_admin_menu":"اقدامات موضوع","wizard_required":"به دیسکورس خوش آمدید! برای شروع نصب \u003ca href='%{url}' data-auto-route='true'\u003eکلیک کنید\u003c/a\u003e ✨","emails_are_disabled":"تمام ایمیل های خروجی بصورت کلی توسط مدیر قطع شده است. هیچگونه ایمیل اگاه سازی ارسال نخواهد شد.","bootstrap_mode_enabled":"برای راه‌اندازی راحت‌تر سایت جدید، حالت خود‌راه‌انداز فعال شده. به تمام کاربران سطح اعتماد 1 اعطا می‌شود و ایمیل خلاصه روزانه به صورت پیشفرض برای ایشان فعال می‌شود. این امکان بصورت خودکار وقتی تعداد کاربران از %{min_users} بیشتر شود، غیر فعال خواهد شد.","bootstrap_mode_disabled":"حالت خود راه انداز در 24 ساعت آینده غیر‌فعال خواهد شد.","themes":{"default_description":"پیش‌فرض","broken_theme_alert":"ممکن است سایت شما به دلیل خطا در قالب %{theme} کار نکند. آن را در مسیر زیر از کار بیندازید: %{path}"},"s3":{"regions":{"ap_northeast_1":"آسیا و اقیانوسیه (توکیو)","ap_northeast_2":"آسیا و اقیانوسیه (سئول)","ap_south_1":"آسیا و اقیانوسیه (بمبئی)","ap_southeast_1":"آسیا و اقیانوسیه (سنگاپور)","ap_southeast_2":"آسیا و اقیانوسیه (سیدنی)","ca_central_1":"کانادا (مرکزی)","cn_north_1":"چین (پکن)","cn_northwest_1":"چین (نینگ‌شیا)","eu_central_1":"اروپا (فرانکفورت)","eu_north_1":"اتحادیه اروپا (استکهلم)","eu_west_1":"اروپا (ایرلند)","eu_west_2":"اروپا (لندن)","eu_west_3":"اتحادیه اروپا (پاریس)","sa_east_1":"آمریکای جنوبی (سائوپائولو)","us_east_1":"شرق ایالات متحده (ویرجینیا شمالی)","us_east_2":"شرق ایالات متحده (اوهایو)","us_gov_east_1":"AWS GovCloud (ایالات متحده - شرق)","us_gov_west_1":"AWS GovCloud (US-West)","us_west_1":"غرب ایالات متحده (کالیفرنیا شمالی)","us_west_2":"غرب ایالات متحده (اورگان)"}},"edit":"موضوع و دسته‌ی این موضوع را ویرایش کنید","expand":"باز کردن","not_implemented":"آن ویژگی هنوز به کار گرفته نشده، متأسفیم!","no_value":"خیر","yes_value":"بله","submit":"ارسال","generic_error":"متأسفیم، خطایی روی داده.","generic_error_with_reason":"خطایی روی داد: %{error}","go_ahead":"ادامه دهید","sign_up":"ثبت نام","log_in":"ورود","age":"سن","joined":"ملحق شده","admin_title":"مدیر","show_more":"بیش‌تر نشان بده","show_help":"گزینه‌ها","links":"پیوندها","links_lowercase":{"one":"پیوندها","other":"پیوندها"},"faq":"پرسش‌های متداول","guidelines":"راهنماها","privacy_policy":"سیاست حفظ حریم خصوصی","privacy":"حریم خصوصی","tos":"شرایط استفاده از خدمات","rules":"قوانین","conduct":"دستورالعمل","mobile_view":"نمایش برای موبایل ","desktop_view":"نمایش برای کامپیوتر","you":"شما","or":"یا","now":"هم‌اکنون","read_more":"بیشتر بخوانید","more":"بیشتر","less":"کمتر","never":"هرگز","every_30_minutes":"هر 30 دقیقه","every_hour":"هر ساعت","daily":"روزانه","weekly":"هفتگی","every_month":"هر ماه","every_six_months":"هر شش ماه","max_of_count":"حداکثر {{count}}","alternation":"یا","character_count":{"one":"{{count}} نویسه","other":"{{count}} نویسه"},"related_messages":{"title":"پیام‌های مرتبط","see_all":"\u003ca href=\"%{path}\"\u003eتمام پیام‌های\u003c/a\u003eاز طرف%{username}@ را ببینید"},"suggested_topics":{"title":"موضوعات پیشنهادی","pm_title":"پیام‌های پیشنهادی"},"about":{"simple_title":"درباره","title":"درباره %{title}","stats":"آمارهای سایت","our_admins":"مدیران ارشد ما","our_moderators":"مدیران ما","moderators":"مدیران","stat":{"all_time":"کل","last_7_days":"7 تای آخر","last_30_days":"30 تای آخر"},"like_count":"پسند‌ها ","topic_count":"موضوعات","post_count":"نوشته‌ها","user_count":"کاربران","active_user_count":"کاربران فعال","contact":"ارتباط با ما","contact_info":"در شرایط حساس و مسائل اضطراری مربوط به سایت٬‌ لطفا از طریق %{contact_info} با تماس بگیرید."},"bookmarked":{"title":"نشانک","clear_bookmarks":"پاک کردن نشانک‌ها","help":{"bookmark":"کلیک کنید تا به اولین نوشته این موضوع نشانک بزنید","unbookmark":"کلیک کنید تا همهٔ نشانک‌های این موضوع را حذف کنید"}},"bookmarks":{"created":"شما این نوشته را نشانک زده‌اید","not_bookmarked":"این نوشته را نشانک بزنید","remove":"پاک کردن نشانک","confirm_clear":"آیا مطمئنید می‌خواهید همه‌ی نشانک‌های خود را از این موضوع پاک کنید؟","save":"ذخیره","no_timezone":"شما هنوز منطقه زمانی مشخص نکرده اید. شما قادر به تنظیم کردن یادآوری نیستید. یکی را در \u003ca href=\"%{basePath}/my/preferences/profile\"\u003e پروفایل تان \u003c/a\u003e تنظیم کنید.","reminders":{"at_desktop":"بار آینده من پشت میزم هستم","later_today":"امروز","tomorrow":"فردا","next_week":"هفته بعد","later_this_week":"این هفته","next_month":"ماه بعد","custom":"درج تاریخ و ساعت"}},"drafts":{"resume":"از سر گیری","remove":"پاک کردن","new_topic":"درفت جدید برای مبحث","new_private_message":"درفت جدید برای پیام","topic_reply":"پاسخ درفت","abandon":{"confirm":"شما پیش از این یک پیش نویس در این مبحث باز کرده اید. مطمئنید میخواهید آن را حذف کنید؟","yes_value":"بله، رها کن","no_value":"خیر، نگه دار"}},"topic_count_latest":{"one":"{{count}} موضوع تازه یا به‌ روز شده.","other":"{{count}} موضوع تازه یا به‌ روز شده."},"topic_count_unread":{"one":"خواندن {{count}} موضوعات خوانده نشده","other":"خواندن {{count}} موضوع خوانده نشده"},"topic_count_new":{"one":"مشاهده {{count}} موضوعات جدید","other":"مشاهده {{count}} موضوع جدید"},"preview":"پیش‌نمایش","cancel":"لغو","save":"ذخیره سازی تغییرات","saving":"در حال ذخیره...","saved":"ذخیره شد!","upload":"بارگذاری","uploading":"در حال بارگذاری...","uploading_filename":"بارگذاری {{filename}}...","clipboard":"کلیپ بورد","uploaded":"بارگذاری شد!","pasting":"چسباندن...","enable":"فعال کردن","disable":"ازکاراندازی","continue":"ادامه","undo":"بی‌اثر کردن","revert":"برگشت","failed":"ناموفق","switch_to_anon":"ورود به حالت ناشناس","switch_from_anon":"خروج از حالت ناشناس","banner":{"close":"این بنر را ببند.","edit":"این بنر را ویرایش کنید \u003e\u003e"},"pwa":{"install_banner":"ایامایل هستید تا \u003ca href\u003e، %{title} را بر‌روی دستگاه شما نصب کند؟\u003c/a\u003e"},"choose_topic":{"none_found":"موضوعی یافت نشد.","title":{"search":"جستجوی یک موضوع","placeholder":"جستجوی بر اساس عنوان، لینک و یا آیدی"}},"choose_message":{"none_found":"پیامی پیدا نشد","title":{"search":"جستجو برای یک پیام","placeholder":"عنوان پیام، لینک و یا آیدی آن را اینجا وارد کنید"}},"review":{"order_by":"به ترتیب","in_reply_to":"در پاسخ به","explain":{"why":"توضیح دهید که چرا این مورد در صف پایان یافت","title":"امتیازدهی قابل تجدید نظر","formula":"فرمول","subtotal":"جمع جزء","total":"مجموع","min_score_visibility":"حداقل امتیاز برای دیده شدن","score_to_hide":"امتیاز برای پنهان کردن پست","take_action_bonus":{"name":"اقدام كرد","title":"زمانی که یکی از کارمندان انتخاب می کند که اقدام کند، پرچم یک امتیاز می دهد."},"user_accuracy_bonus":{"name":"دقت کاربر","title":"کاربرانی که پرچم آن ها به طور گروهی پذیرفته شده است، یک امتیاز دریافت می کنند."},"trust_level_bonus":{"name":"سطح اعتماد","title":"موارد قابل بررسی که توسط کاربرانی با میزان اعتماد بیشتر ایجاد شده اند، اولویت بالاتری دارند."},"type_bonus":{"name":"امتیاز را وارد کنید","title":"موارد قابل بررسی خاص می توانند کارمندان دارای امتیاز شوند تا اولویت آن ها را بیشتر کند."}},"claim_help":{"optional":"می‌توانید این مورد را درخواست کنید تا دیگران را از بازنگری آن بازنگه دارید.","required":"شما قبل از بازنگری موارد باید آن‌ها را درخواست دهید .","claimed_by_you":"می‌توانید این مورد را درخواست کنید و آن را بازنگری کنید.","claimed_by_other":"این مورد فقط توسط کاربر\u003cb\u003e{{username}} \u003c/b\u003eقابل بازنگری است."},"claim":{"title":"درخواست این مبحث"},"unclaim":{"help":"حذف درخواست"},"awaiting_approval":"منتظر تایید","delete":"حذف","settings":{"saved":"ذخیره شد","save_changes":"ذخیره تغییرات","title":"تنظیمات","priorities":{"title":"اولویت های بازنگری"}},"moderation_history":"تاریخچه مدیریت","view_all":"نمایش همه","grouped_by_topic":"دسته بندی مبحث ها","none":"هیچ موردی برای بازنگری وجود ندارد","view_pending":"نمایش صف انتظار","topic_has_pending":{"one":"این مبحث \u003cb\u003e%{count}\u003c/b\u003eنوشته در حال انتظار دارد","other":"این مبحث \u003cb\u003e{{count}}\u003c/b\u003eنوشته در حال انتظار دارد."},"title":"بازنگری","topic":"موضوع:","filtered_topic":"شما یک مبحث را بر حسب محتوای قابل بازنگری فیلتر کرده‌اید","filtered_user":"کاربر","show_all_topics":"نمایش همه ی مباحث","deleted_post":"(نوشته حذف شده)","deleted_user":"(کاربر حذف شده)","user":{"bio":"بیوگرافی","website":"وبسایت","username":"نام‌کاربری","email":"ایمیل","name":"نام","fields":"فیلدها"},"user_percentage":{"summary":{"one":"{{agreed}}، {{disagreed}}، {{ignored}}({{count}}پرچم)","other":"{{agreed}}، {{disagreed}}، {{ignored}} ({{count}}پرچم)"},"agreed":{"one":"{{count}}% موافقت شده","other":"{{count}}% موافقت شده"},"disagreed":{"one":"{{count}}% موافقت نشده","other":"{{count}}% موافقت نشده"},"ignored":{"one":"{{count}}% صرف نظر شده","other":"{{count}}% صرف نظر شده"}},"topics":{"topic":"موضوعات","reviewable_count":"تعداد","reported_by":"گزارش شده توسط","deleted":"[مبحث حذف شده]","original":"(مبحث اصلی)","details":"جزئیات","unique_users":{"one":"%{count}کاربر","other":"{{count}}کاربر"}},"replies":{"one":"%{count}پاسخ","other":"{{count}}پاسخ"},"edit":"ویرایش","save":"ذخیره","cancel":"لغو کردن","new_topic":"تایید این مورد یک مبحث جدید ایجاد خواهد کرد.","filters":{"all_categories":"(تمام دسته بندی ها)","type":{"title":"نوع","all":"(همه نوع)"},"minimum_score":"حداقل امتیاز :","refresh":"تازه کردن","status":"وضعیت","category":"دسته‌بندی","orders":{"priority":"اولویت","priority_asc":"اولویت (برعکس)","created_at":"ساخته شده","created_at_asc":"ساخته شده (برعکس)"},"priority":{"title":"کمترین اولویت","low":"(هر چی)","medium":"متوسط","high":"بالا"}},"conversation":{"view_full":"نمایش همه ی مباحث"},"scores":{"about":"این امتیاز بر اساس سطح اعتماد گزارش دهنده، دقت پرچم‌های قبلی ایشان، و اولویت مورد گزارش شده حساب میشود، ","score":"امتیاز","date":"تاریخ","type":"نوع","status":"وضعیت","submitted_by":"ارسال شده توسط","reviewed_by":"بازنگری شده توسط"},"statuses":{"pending":{"title":"در انتظار"},"approved":{"title":"پذیرفته شده"},"rejected":{"title":"رد شده"},"ignored":{"title":"صرف نظر شده"},"deleted":{"title":"حذف شده"},"reviewed":{"title":"(همه مرور شده)"},"all":{"title":"(همه)"}},"types":{"reviewable_flagged_post":{"title":"نوشته پرچم شده","flagged_by":"پرچم شده توسط"},"reviewable_queued_topic":{"title":"مبحث های در صف"},"reviewable_queued_post":{"title":"نوشته در صف"},"reviewable_user":{"title":"کاربر"}},"approval":{"title":"نوشته نیاز به تایید دارد","description":"ما نوشته شما را دریافت کرده ایم ولی قبل از نمایش نیاز به تایید آن توسط یکی از مدیران است. لطفا صبر داشته باشید.","pending_posts":{"one":"شما \u003cstrong\u003e%{count}\u003c/strong\u003e نوشته در انتظار دارید","other":"شما \u003cstrong\u003e{{count}}\u003c/strong\u003e نوشته در انتظار دارید"},"ok":"باشه"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e \u003ca href='{{topicUrl}}'\u003eیک موضوع\u003c/a\u003e ایجاد کرد","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eشما یک \u003c/a\u003e\u003ca href='{{topicUrl}}'\u003eموضوع\u003c/a\u003e جدید ایجاد کردید.","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e\n به \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e پاسخ داد","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eشما\u003c/a\u003e\n به \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e پاسخ دادید","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e\n به \u003ca href='{{postUrl}}'\u003eموضوع\u003c/a\u003e پاسخ داد","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eشما\u003c/a\u003e\n به \u003ca href='{{postUrl}}'\u003eموضوع\u003c/a\u003e پاسخ دادید","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e mentioned \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e به \u003ca href='{{user2Url}}'\u003eشما\u003c/a\u003e اشاره کرد","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eشما\u003c/a\u003e به \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e اشاره کردید","posted_by_user":"ارسال شده توسط \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","posted_by_you":"ارسال شده توسط \u003ca href='{{userUrl}}'\u003eشما\u003c/a\u003e","sent_by_user":"ارسال شده توسط \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e","sent_by_you":"ارسال شده توسط \u003ca href='{{userUrl}}'\u003eشما\u003c/a\u003e"},"directory":{"filter_name":"فیلتر بر اساس نام کاربری","title":"کاربران","likes_given":"داده شده","likes_received":"دریافت شده","topics_entered":"دیده شده","topics_entered_long":"موضوعات دیده شده","time_read":"زمان خواندن","topic_count":"موضوعات","topic_count_long":"موضوعات ساخته شده","post_count":"پاسخ‌ها","post_count_long":"پاسخ‌های نوشته شده","no_results":"نتیجه ای یافت نشد.","days_visited":"بازدید‌ها","days_visited_long":"روز‌های بازدید شده","posts_read":"خواندن","posts_read_long":"نوشته‌های خوانده شده","total_rows":{"one":"%{count} کاربر","other":"%{count} کاربر"}},"group_histories":{"actions":{"change_group_setting":"تغییر تنظیمات گروه","add_user_to_group":"افزودن کاربر","remove_user_from_group":"حذف کاربر","make_user_group_owner":"مدیر کردن","remove_user_as_group_owner":"لغو مالکیت"}},"groups":{"member_added":"اضافه شده","member_requested":"درخواست شده در","add_members":{"title":"افزودن اعضا","description":"مدیریت عضویت کاربران در این گروه","usernames":"نام های کاربری"},"requests":{"title":"درخواست ها","reason":"دلیل","accept":"پذیرفتن","accepted":"تأیدد شده","deny":"رد کردن","denied":"رد شده","undone":"بازگرداندن درخواست"},"manage":{"title":"مدیریت","name":"نام","full_name":"نام کامل","add_members":"افزودن اعضا","delete_member_confirm":"کاربر '%{username}' از گروه '%{group}' حذف شود؟","profile":{"title":"مشخصات کاربر"},"interaction":{"title":"تراکنش","posting":"در حال نوشتن","notification":"اعلان‌ها"},"membership":{"title":"عضویت","access":"دسترسی"},"logs":{"title":"گزارش‌ها","when":"وقتی‌که","action":"اقدام","acting_user":"کاربر فعال","target_user":"کاربر هدف","subject":"موضوع","details":"جزئیات","from":"از طرف","to":"به"}},"public_admission":"به کاربران اجازه می دهد به اختیار عضو گروه ها شوند (به یک گروه قابل مشاهده برای عموم نیاز دارد)","public_exit":"اجازه دادن به کاربران برای ترک گروه به اختیار","empty":{"posts":"در این گروه هیچ نوشته ای توسط کاربران ارسال نشده.","members":"این گروه هیچ عضوی ندارد","requests":"هیچ درخواست عضویتی برای این گروه وجود ندارد","mentions":"هیچ اشاره ای به این گروه وجود ندارد.","messages":"هیچ پیامی برای این گروه وجود ندارد.","topics":"در این گروه هیچ موضوعی توسط اعضای آن ایجاد نشده.","logs":"هیچ گزارشی برای این گروه موجود نیست."},"add":"افزودن","join":"عضو شدن","leave":"ترک کردن","request":"درخواست","message":"پیام","confirm_leave":"آیا از ترک این گروه مطمئن هستید؟","allow_membership_requests":"به کاربرها اجازه ی ارسال درخواست عضویت به صاحبان گروه را بدهید\n(گروه باید برای عموم قابل دیدن باشد)","membership_request_template":"الگوی سفارشی برای نمایش به کاربران هنگام ارسال درخواست عضویت","membership_request":{"submit":"ارسال درخواست","title":"درخواست پیوستن به @%{group_name}","reason":"اجازه دهید مالکان گروه بدانند چرا به این گروه تعلق دارید"},"membership":"عضویت","name":"نام","group_name":"نام گروه","user_count":"کاربران","bio":"درباره گروه","selector_placeholder":"نام کاربری را وارد کنید","owner":"مالک","index":{"title":"گروه‌ها","all":"همه گروهها","empty":"هیچ گروه قابل نمایشی وجود ندارد.","filter":"فیلتر با نوع گروه","owner_groups":"گروه های تحت مالکیت من","close_groups":"گروه های بسته","automatic_groups":"گروههای خودکار","automatic":"خودکار","closed":"بسته","public":"عمومی","private":"خصوصی","public_groups":"گروههای عمومی","automatic_group":"گروه خودکار","close_group":"بستن گروه","my_groups":"گروههای من","group_type":"نوع گروه","is_group_user":"عضو","is_group_owner":"مالک"},"title":{"one":"گروه ها","other":"گروه ها"},"activity":"فعالیت","members":{"title":"اعضاء","filter_placeholder_admin":"نام کاربری یا ایمیل","filter_placeholder":"نام کاربری","remove_member":"اخراج عضو","remove_member_description":"اخراج \u003cb\u003e%{username}\u003c/b\u003e از این گروه","make_owner":"اعطای مالکیت","make_owner_description":"دادن مالکیت این گروه به \u003cb\u003e%{username}\u003c/b\u003e","remove_owner":"حذف توسط مالک","remove_owner_description":"حذف کاربر \u003cb\u003e%{username}\u003c/b\u003e به عنوان مالک این گروه","owner":"مالک","forbidden":"شما مجاز به دیدن کاربران نیستید."},"topics":"موضوعات","posts":"نوشته‌ها","mentions":"اشاره‌ها","messages":"پیام‌ها","notification_level":"سطح آگاه‌سازی پیش‌فرض برای پیام‌های گروهی","alias_levels":{"mentionable":"چه کسی می تواند به این گروه @اشاره کند؟","messageable":"چه کسی می تواند به این گروه پیام دهد؟","nobody":"هیچ‌کس","only_admins":"فقط مدیران ارشد","mods_and_admins":"فقط مدیران و مدیران ارشد","members_mods_and_admins":"تنها اعضای گروه، مدیران ومدیران ارشد","owners_mods_and_admins":"فقط مالکان گروه، ناظران و مدیران","everyone":"همه"},"notifications":{"watching":{"title":"در حال مشاهده","description":"در صورت ارسال شدن پست جدید در هر پیام یک اعلان برای شما ارسال می‌شود و تعداد پاسخ‌های جدید در آن نمایش داده می‌شود."},"watching_first_post":{"title":"در حال مشاهده نوشته اول","description":"شما از پیام های جدید این گروه آگاه می‌شوید ولی برای پاسخ به پیام ها آگاه سازی نمی‌گیرید."},"tracking":{"title":"پیگیری","description":"اگر کسی به @نام شما اشاره کند یا به شما پاسخ دهد، اعلانی برای شما ارسال می‌شود و تعداد پاسخ‌های جدید نمایش داده می‌شود."},"regular":{"title":"معمولی","description":"در صورتی که به @نام شما اشاره شود یا پاسخی دریافت کنید اعلانی برای شما ارسال می‌شود."},"muted":{"title":"بی‌صدا شد","description":"شما برای هر اتفاقی در ارتباط با پیام های این گروه آگاه سازی می‌گیرید."}},"flair_url":"تصویر آواتار","flair_url_placeholder":"(اختیاری) URL تصویر و یا کلاس Font Awesome","flair_url_description":"از تصاویر مربعی بزرگتر از ۲۰پیکسل × ۲۰ پیکسل و یا ایکون های فونت آسام استفاده کنید (فرمت های قابل قبول: \"fa-icon\", \"far fa-icon\", \"fab fa-icon\" ).","flair_bg_color":"رنگ پس زمینه آواتار","flair_bg_color_placeholder":"(اختیاری) کد HEX رنگ","flair_color":"رنگ آواتار","flair_color_placeholder":"(اختیاری) کد HEX رنگ","flair_preview_icon":"پیش‌نمایش آیکن","flair_preview_image":"پیش‌نمایش تصویر"},"user_action_groups":{"1":"پسندهای داده شده","2":"پسندهای دریافت شده","3":"نشانک‌ها","4":"موضوعات","5":"پاسخ‌ها","6":"واکنش‌ها","7":"اشاره‌ها","9":"نقل‌قول‌ها","11":"ویرایش‌ها","12":"موارد ارسال شده","13":"صندوق دریافت","14":"در انتظار","15":"درفت"},"categories":{"all":"همه‌ی دسته‌بندی‌ها","all_subcategories":"همه","no_subcategory":"هیچی","category":"دسته‌بندی","category_list":"نمایش فهرست دسته‌بندی","reorder":{"title":"دوباره مرتب کردن دسته بندی‌ها","title_long":"سازماندهی مجدد فهرست دسته بندی‌ها","save":"ذخیره‌ی ترتیب","apply_all":"اعمال کردن","position":"موقعیت"},"posts":"نوشته‌ها","topics":"موضوعات","latest":"آخرین","latest_by":"آخرین توسط","toggle_ordering":"ضامن کنترل مرتب سازی","subcategories":"دسته‌‌بندی‌های فرزند","topic_sentence":{"one":"%{count} موضوع","other":"%{count} موضوع"},"topic_stat_sentence_week":{"one":"%{count} مبحث جدید در هفته ی گذشته","other":"%{count} مبحث جدید در هفته ی گذشته"},"topic_stat_sentence_month":{"one":"%{count} مبحث جدید در ماه گذشته","other":"%{count} مبحث جدید در ماه گذشته"},"n_more":"دسته‌بندی‌ها ( %{count}مورد دیگر)"},"ip_lookup":{"title":"جستجوی نشانی IP","hostname":"نام میزبان","location":"موقعیت","location_not_found":"(ناشناس)","organisation":"سازمان","phone":"تلفن","other_accounts":"سایر حساب‌های کاربری با این ای پی:","delete_other_accounts":"حذف %{count}","username":"نام کاربری","trust_level":"سطح اعتماد","read_time":" زمان خواندن","topics_entered":"موضوعات وارد شده","post_count":"# نوشته","confirm_delete_other_accounts":"آیا مطمئن هستید که می خواهید این حساب کاربری را حذف نمایید؟","powered_by":"استفاده از \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"کپی شده"},"user_fields":{"none":"(یک گزینه انتخاب کنید)"},"user":{"said":"{{username}}:","profile":"نمایه","mute":"بی‌صدا","edit":"ویرایش تنظیمات","download_archive":{"button_text":"دانلود همه","confirm":"آیا مطمئنید که می‌خواهید نوشته‌هایتان را دانلود کنید؟","success":"شروع فرایند دانلود، وقتی این فرایند تکمیل شود به شما از طریق پیام، اطلاع رسانی خواهد شد.","rate_limit_error":"نوشته‌ها را می توانید فقط یک بار در روز می‌توانید دانلود کنید. لطفا فردا دوباره امتحان کنید."},"new_private_message":"پیام جدید","private_message":"پیام","private_messages":"پیام‌ها","user_notifications":{"ignore_duration_title":"از زمانسنج صرف نظر کن","ignore_duration_username":"نام‌کاربری","ignore_duration_when":"مدت زمان:","ignore_duration_save":"چشم پوشی","ignore_duration_note":"توجه کنید همه ی صرف نظر شده ها بعد از انقضای زمان صرف نظر برداشته میشود.","ignore_duration_time_frame_required":"یک بازه ی زمانی انتخاب کنید","ignore_no_users":"هیچ کاربر صرف نظر شده ای ندارید","ignore_option":"صرف نظر شده","ignore_option_title":"هیچ آگاه سازی از این کاربر دریافت نمی‌کنید و مبحث ها یا نوشته های ایشان برای شما نمایش داده نخواهد شد.","add_ignored_user":"اضافه کردن ...","mute_option":"بی‌صدا شد","mute_option_title":"هیچ اگاه سازی از این کاربر دریافت نمیکنید","normal_option":"معمولی","normal_option_title":"اگر این کاربر به شما پاسخ دهد، از شما نقل قول کند و یا شما را صدا کند، اگاه سازی دریافت میکنید"},"activity_stream":"فعالیت","preferences":"تنظیمات","feature_topic_on_profile":{"open_search":"انتخاب یک موضوع نو","title":"انتخاب یک موضوع","search_label":"جستجوی یک موضوع بر اساس عنوان","save":"ذخیره","clear":{"title":"واضح","warning":"آیا از پاکسازی موضوع برجسته ی خود مطمئن هستید؟"}},"profile_hidden":"صفحه نمایه این کاربر مخفی است","expand_profile":"باز کردن","collapse_profile":"جمع کردن","bookmarks":"نشانک‌ها","bio":"درباره من","timezone":"منطقه ی زمانی","invited_by":"دعوت شده توسط","trust_level":"سطح اعتماد","notifications":"آگاه‌سازی‌ها","statistics":"وضعیت","desktop_notifications":{"label":"اگاه سازی زنده","not_supported":"اعلانات بر روی این مرورگر پشتیبانی نمیشوند. با عرض پوزش.","perm_default":"فعال کردن اعلانات","perm_denied_btn":"دسترسی رد شد","perm_denied_expl":"شما دسترسی دریافت اعلان را بسته‌اید. در تنظیمات مرورگر خود آن‌را فعال کنید.","disable":"غیرفعال کردن اعلانات","enable":"فعال کردن اعلانات","each_browser_note":"نکته: شما باید این تنظیمات را در هر مرورگری که استفاده میکنید تغییر دهید.","consent_prompt":"ایا مایلید وقتی دیگران به شما پاسخ میدهند، اگاه سازی زنده دریافت کنید؟"},"dismiss":"نخواستیم","dismiss_notifications":"پنهان کردن همه","dismiss_notifications_tooltip":"علامت گذاری همه اطلاعیه های خوانده نشده به عنوان خوانده شده","first_notification":"اولین پیام اطلاع‌رسانی شما! برای شروع آن‌را انتخاب کنید.","dynamic_favicon":"نمایش تعداد در ایکون بروسر","theme_default_on_all_devices":"این قالب، حالت پیش فرض در همه ی دستگاه های من باشد","text_size_default_on_all_devices":"این سایز قلم حالت پیش فرض در تمام دستگاه های من باشد","allow_private_messages":"به دیگر کاربران اجازه بده به من پیام شخصی بفرستند","external_links_in_new_tab":"همهٔ پیوندهای خروجی را در یک تب جدید باز کن","enable_quoting":"فعال کردن نقل قول گرفتن از متن انتخاب شده","enable_defer":"تاخیر را برای علامت زدن مباحث به عنوان خوانده نشده فعال کن","change":"تغییر","featured_topic":"مبحث برجسته","moderator":"{{user}} یک مدیر است","admin":"{{user}} یک مدیر ارشد است","moderator_tooltip":"این کاربر یک مدیر است","admin_tooltip":"این کاربر یک ادمین است","silenced_tooltip":"صدای این کاربر قطع شده است","suspended_notice":"این کاربر تا {{date}} در وضعیت معلق است.","suspended_permanently":"این کاربر معلق شده.","suspended_reason":"دلیل: ","github_profile":"Github","email_activity_summary":"چکیده‌ی فعالیت","mailing_list_mode":{"label":"حالت لیست ایمیل","enabled":"فعالسازی حالت لیست ایمیل","instructions":"این تنظیمات جایگزین گزارش فعالیت می‌شود.\u003cbr /\u003e\nموضوعات و دسته‌بندی‌های قفل شده در این ایمیل‌ها نخواهند بود.\n","individual":"ارسال یک ایمیل برای هر پست جدید","individual_no_echo":"ارسال ایمیل برای هر پست جدید، به جز پست‌های خودم","many_per_day":"برای هر پست جدید یک ایمیل برای من بفرست. (حدود {{dailyEmailEstimate}} در روز)","few_per_day":"ارسال یک ایمیل برای هر پست جدید (حدود 2 ایمیل در روز)","warning":"حالت ایمیل فعال شد. تنظیمات اگاه سازی ایمیلی بازنویسی میشود."},"tag_settings":"برچسب‌ها","watched_tags":"تماشا شده","watched_tags_instructions":"تمام موضوعاتی که دارای این برچسب هستند مشاهده خواهید کرد و گزارش و تعداد نوشته‌ها و موضوعات را کنار موضوع مشاهده خواهید کرد.","tracked_tags":"پی‌گیری شده","tracked_tags_instructions":"شما به صورت خودکار تمام عناوین جدید در این برچسب را پیگیری خواهید کرد. تعداد نوشته های جدید در کنار عنواین نمایش داده می‌شود.","muted_tags":"بی‌صدا","muted_tags_instructions":"شما از اتفاقات موضوعات جدید این برچسب‌ها آگاه نمیشوید، و آن ها در آخرین ها نمایش داده نمیشوند.","watched_categories":"تماشا شده","watched_categories_instructions":"تمام موضوعاتی که دارای این دسته‌بندی هستند مشاهده و گزارش و تعداد نوشته‌ها و موضوعات را کنار موضوع مشاهده خواهید کرد.","tracked_categories":"پی‌گیری شده","tracked_categories_instructions":"به صورت خود‌کار تمامی موضوعات این دسته‌بندی را پیگیری خواهید کرد. تعداد نوشته‌های جدید در کنار موضوعات نمایش داده می‌شود.","watched_first_post_categories":"در حال مشاهده نوشته اول","watched_first_post_categories_instructions":"برای اولین پست موضوعات جدید به شما اطلاع‌رسانی می‌شود","watched_first_post_tags":"درحال مشاهده نوشته اول","watched_first_post_tags_instructions":"از اولین نوشته هر موضوع که شامل این برچسب‌ها باشد مطلع خواهید شد.","muted_categories":"بی‌صدا","muted_categories_instructions":"شما درباره هیچ اتفاقی در این دسته بندی آگاهسازی دریافت نمیکنید و آن ها در دسته بندی ها و یا صفحه تازه ها نمایش داده نخواهند شد.","muted_categories_instructions_dont_hide":"شما درباره هیچ اتفاقی در این دسته بندی آگاهسازی دریافت نمیکنید.","no_category_access":"به عنوان یک مدیر دسترسی محدودی به این دسته بندی دارید، ذخیره سازی غیر فعال است.","delete_account":"حساب‌کاربری من را پاک کن","delete_account_confirm":"آیا مطمئنید که می‌خواهید شناسه‌تان را برای همیشه پاک کنید؟ برگشتی در کار نیست!","deleted_yourself":"حساب‌ کاربری شما با موفقیت حذف شد.","delete_yourself_not_allowed":"اگر مایل هستید حساب کاربری تان حذف شود با یکی از مدیران تماس بگیرید.","unread_message_count":"پیام‌ها","admin_delete":"پاک کردن","users":"کاربران","muted_users":"بی‌صدا","muted_users_instructions":"متوقف کردن تمام اطلاعیه ها از طرف این کاربران.","ignored_users":"صرف نظر شده","ignored_users_instructions":"تمام نوشته ها و اگاه سازی ها از این کاربران را خاموش کنید.","tracked_topics_link":"نمایش","automatically_unpin_topics":"برداشتن پین موضوعات وقتی به پایین صفحه رسیدم.","apps":"برنامه‌ها","revoke_access":"لغو دسترسی","undo_revoke_access":"بازنشانی لغو دسترسی","api_approved":"تایید شده:","api_last_used_at":"آخرین بار استفاده شده در","theme":"قالب","home":"صفحه خانگی پیشفرض","staged":"کاربر از راه دور","staff_counters":{"flags_given":"پرچم گذاری‌های مفید","flagged_posts":"نوشته های پرچم گذاری شده","deleted_posts":"پست های حذف شده","suspensions":"تعلیق‌ها","warnings_received":"هشدارها"},"messages":{"all":"همه","inbox":"صندوق دریافت","sent":"ارسال شد","archive":"بایگانی","groups":"گروه‌های من","bulk_select":"انتخاب پیام‌ها","move_to_inbox":"انتقال به صندوق دریافت","move_to_archive":"بایگانی","failed_to_move":"انتقال پیام‌های انتخاب شده با اشکال مواجه شد (شاید اتصال شما در دسترس نیست)","select_all":"انتخاب همه","tags":"برچسب‌ها"},"preferences_nav":{"account":"حساب کاربری","profile":"پروفایل","emails":"ایمیل‌ها","notifications":"اطلاعیه‌ها","categories":"دسته‌بندی‌ها","users":"کاربران","tags":"برچسب‌‌ها","interface":"رابط","apps":"برنامه‌ها"},"change_password":{"success":"(ایمیل ارسال شد)","in_progress":"(فرستادن ایمیل)","error":"(خطا)","action":"ارسال ریست رمز عبور به ایمیل ","set_password":"تغییر رمز‌عبور","choose_new":"یک رمز‌عبور جدید وارد کنید","choose":"یک رمز‌عبور وارد کنید"},"second_factor_backup":{"title":"کدهای پشتیبان دو عامله","regenerate":"ایجاد مجدد","disable":"ازکاراندازی","enable":"فعال کردن","enable_long":"کدهای پشتیبان را به کار بگیر","manage":"مدیریت کد‌های پشتیبانی، \u003cstrong\u003e{{count}}\u003c/strong\u003e از کد‌های پشتیبانی شما باقی مانده","copied_to_clipboard":"کپی شد","copy_to_clipboard_error":"خطا در کپی اطلاعات","remaining_codes":"شما \u003cstrong\u003e{{count}}\u003c/strong\u003eکد پشتیبان باقی مانده دارید.","use":"از کد پشتیبان استفاده کنید","enable_prerequisites":"شما باید قبل از ساخت کد‌های پشتیبانی یک تایید هویت دوعاملی اصلی را فعال کنید ","codes":{"title":"کد پشتیبان تولید شد","description":"هر کدام از این کدهای پشتیبان فقط یک بار قابل استفاده است. آن ها را در جای امن و قابل دسترسی نگه دارید."}},"second_factor":{"title":"احراز هویت دو مرحله ای","enable":"مدیریت تایید هوییت دوعاملی","forgot_password":"فراموشی گذرواژه؟","confirm_password_description":"لطفا رمز عبور خود را تایید کنید تا ادامه دهیم.","name":"نام","label":"کد","rate_limit":"لطفا قبل از اینکه کد احراز هویت دیگری را تست کنید کمی صبر کنید","enable_description":"این کد QR را در یک اپلیکیشن مورد تایید (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eآندروید\u003c/a\u003e -- \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eIOS\u003c/a\u003e) و کد احراز هویت خود را وارد کنید.\n","disable_description":"لطفا کد احراز هویت را از اپلیکیشن خود وارد کنید","show_key_description":"دستی وارد کنید","short_description":"حساب کاربری خود را با کد امنیتی یک بار مصرف محافظت کنید\n","extended_description":"احراز هویت دو عامله امنیت بیشتری به حساب کاربری شما میدهد، چرا که یک توکن یک بار مصرف علاوه بر رمز عبور خود خواهید داشت. توکن ها در ابزارهای \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eاندروید\u003c/a\u003e و \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eIOS\u003c/a\u003e قابل تولید هستند.\n","oauth_enabled_warning":"دقت کنید وقتی احراز هویت دوعامله فعال شود، ورود با حساب شبکه های اجتماعی به حساب کاربری شما از کار میفتد.","use":"از اپلیکیشن احراز هویت استفاده کنید","enforced_notice":"شما باید احراز هویت دو عامله را قبل از دسترسی به سایت فعال کنید","disable":"غیرفعال","disable_title":"غیر فعال کردن تایید دوعاملی","disable_confirm":"ایا از غیرفعال‌ سازی تمامی تایید‌های دوعاملی مطمعن‌ هستید؟","edit":"ویرایش","edit_title":"ویرایش تایید دوعاملی","edit_description":"نام تایید دوعاملی","totp":{"title":"تایید برپایه توکن","add":"تایید کننده جدید","default_name":"تایید‌کننده من"},"security_key":{"register":"ثبت‌نام","title":"کلیدهای امنیتی","add":"کلید امنیتی را ثبت کنید","default_name":"کلید امنیتی اصلی","not_allowed_error":"روند ثبت کلید امنیتی به پایان رسیده است یا لغو شده است.","edit":"کلید امنیتی را ویرایش کنید","edit_description":"نام کلید امنیتی","delete":"حذف"}},"change_about":{"title":"تغییر «درباره‌ی من»","error":"در فرآیند تغییر این مقدار خطایی روی داد."},"change_username":{"title":"تغییر نام‌کاربری","confirm":"مطمئنید میخواهید نام کاربری خود را تغییر دهید؟","taken":"متأسفیم، آن نام کاربری قبلا گرفته شده است.","invalid":"آن نام کاربری نامعتبر است. تنها باید عددها و حرف‌ها را در بر بگیرد."},"change_email":{"title":"تغییر ایمیل","taken":"متأسفیم، آن ایمیل در دسترس نیست.","error":"در تغییر ایمیلتان خطایی روی داد. شاید آن نشانی از پیش در حال استفاده است؟","success":"ما ایمیلی به آن نشانی فرستاده‌ایم. لطفاً دستورکار تأییده را در آن دنبال کنید.","success_staff":"یک ایمیل به آدرس کنونی شما ارسال کردیم. لطفا دستورالعمل آن را دنبال کنید."},"change_avatar":{"title":"عکس نمایه خود را تغییر دهید","letter_based":"سیستم تصویر پرفایل را اختصاص داده است","uploaded_avatar":"تصویر سفارشی","uploaded_avatar_empty":"افزودن تصویر سفارشی","upload_title":"تصویرتان را بارگذاری کنید","image_is_not_a_square":"اخطار: ما تصویر شما را بریدیم; طول و عرض برابر نبود."},"change_card_background":{"title":"پس زمینه کارت کابر","instructions":"تصاویر پس زمینه در مرکز قرار خواهند گرفت و عرض پیشفرض آن 590 پیکسل است"},"change_featured_topic":{"title":"مبحث برجسته"},"email":{"title":"ایمیل","primary":"آدرس ایمیل اصلی","secondary":"آدرس ایمیل ثانویه","no_secondary":"بدون ایمیل ثانویه","sso_override_instructions":"ایمیل را میتوانید از طریق SSO به روزرسانی کنید","instructions":"هرگز به عموم نمایش داده نخواهد شد","ok":"برای تایید ایمیلی برایتان ارسال خواهیم کرد.","invalid":"لطفا یک آدرس ایمیل معتبر وارد کنید","authenticated":"ایمیل شما توسط {{provider}} تصدیق شد","frequency_immediately":"اگر به سرعت چیزی را که برایتان ارسال نکردیم نخوانده باشید، بلافاصله برایتان ایمیل ارسال می‌کنیم.","frequency":{"one":"ما فقط در صورتی برای شما ایمیل میفرستیم که در {{count}} دقیقه آخر شما را ندیده باشیم.","other":"ما فقط در صورتی برای شما ایمیل میفرستیم که در {{count}} دقیقه آخر شما را ندیده باشیم."}},"associated_accounts":{"title":"حساب های مرتبط","connect":"وصل شدن","revoke":"ابطال ","cancel":"لغو کردن","not_connected":"(وصل نشده)","confirm_modal_title":"اتصال حساب %{provider} ","confirm_description":{"account_specific":"حساب%{provider} شما. %{account_description}برای احراز هویت استفاده خواهد شد.","generic":"حساب کاربری%{provider} شما برای احراز‌هویت استفاده خواهد‌شد."}},"name":{"title":"نام","instructions":"نام و نام‌خانوادگی شما (اختیاری)","instructions_required":"نام و نام خانوادگی شما","too_short":"نام انتخابی شما خیلی کوتاه است","ok":"نام انتخابی شما به نطر می رسد خوب است"},"username":{"title":"نام‌کاربری","instructions":"یکتا، بدون فاصله، کوتاه","short_instructions":"می توانید به کاربران دیگر اشاره کنید با@{{username}}","available":"نام کاربری شما در دسترس است","not_available":"در دسترس نیست. این را امتحان کن {{suggestion}} ؟","not_available_no_suggestion":"در دسترس نیست","too_short":"نام کاربری انتخابی شما خیلی کوتاه است","too_long":"نام کاربری انتخابی شما خیلی طولانی است","checking":"بررسی در دسترس بودن نام‌کاربری...","prefilled":"ایمیل منطبق است با این نام کاربری ثبت شده "},"locale":{"title":"زبان رابط‌کاربری","instructions":"زبان رابط کاربری. با تازه کردن صفحه تغییر خواهد کرد.","default":"(پیش‌فرض)","any":"هر"},"password_confirmation":{"title":"رمز عبور را مجدد وارد نمایید"},"auth_tokens":{"title":"ابزارهایی که اخیرا استفاده شدند","ip":"IP","details":"جزئیات","log_out_all":"از همه خارج شو","active":"الان فعال است","not_you":"شما نیستید؟","show_all":"نمایش همه ({{count}})","show_few":"کمتر نشان بده","was_this_you":"آیا شما بودید؟","was_this_you_description":"اگر شما نبودید، پیشنهاد می‌کنیم رمز عبور خود را تغییر دهید و از همه حساب ها خارج شوید","browser_and_device":"{{browser}} در {{device}}","secure_account":"از حساب کاربری من محافظت کن","latest_post":"آخرین بار شما نوشتید ..."},"last_posted":"آخرین نوشته","last_emailed":"آخرین ایمیل فرستاده شده","last_seen":"مشاهده","created":"عضو شده","log_out":"خروج","location":"موقعیت","website":"تارنما","email_settings":"ایمیل","hide_profile_and_presence":"نمایه کاربری و حضور من را مخفی کن","enable_physical_keyboard":"پشتیبانی کی بورد فیزیکی را در آی پد فعال کن","text_size":{"title":"سایز قلم متن","smaller":"کوچکتر","normal":"معمولی","larger":"بزرگتر","largest":"بزرگترین"},"title_count_mode":{"title":"عنوان صفحه ی بک گراند تعداد زیر را نمایش دهد:","notifications":"آگاهسازی جدید","contextual":"محتوای تازه ی صفحه"},"like_notification_frequency":{"title":"وقتی پسندیده شد اعلام کن","always":"همیشه","first_time_and_daily":"اولین بار که پست پسندیده شد و روزانه","first_time":"اولین بار که پست پسندیده شد","never":"هیچ‌وقت"},"email_previous_replies":{"title":"شامل پاسخ‌های قبلی در پایان ایمیل است.","unless_emailed":"تا قبلی ارسال شود","always":"همیشه","never":"هیچوقت"},"email_digests":{"title":"وقتی به اینجا سر نمیزنم، ایمیلی از خلاصه ی موضوعات و پاسخ های محبوب برای بفرست.","every_30_minutes":"هر 30 دقیقه","every_hour":"هر ساعت","daily":"روزانه","weekly":"هفتگی","every_month":"هر ماه","every_six_months":"هر شش ماه"},"email_level":{"title":"وقتی کسی نوشته‌های مرا نقل‌قول کرد، به من پاسخ داد، به @نام‌کاربری من اشاره کرد، یا مرا به موضوعی دعوت کرد، یک ایمیل برایم بفرست.","always":"همیشه","only_when_away":"فقط وقتی نیستم","never":"هیچوقت"},"email_messages_level":"وقتی کسی به من پیام خصوصی فرستاد، ایمیل بفرست","include_tl0_in_digests":"محتوای ایجاد شده توسط کاربران جدید در ایمیل خلاصه قرار گیرد.","email_in_reply_to":"خلاصه‌ی پاسخ‌ها را در ایمیل قرار بده.","other_settings":"موارد دیگر","categories_settings":"دسته‌بندی‌ها","new_topic_duration":{"label":"موضوعات را جدید در نظر بگیر وقتی","not_viewed":"من هنوز آن ها را ندیدم","last_here":"از آخرین باری که اینجا بودم ساخته شده‌اند","after_1_day":"ایجاد شده در روز گذشته","after_2_days":"ایجاد شده در 2 روز گذشته","after_1_week":"ایجاد شده در هفته گذشته","after_2_weeks":"ایجاد شده در 2 هفته گذشته"},"auto_track_topics":"دنبال کردن خودکار موضوعاتی که وارد آن‌ها می‌شوم","auto_track_options":{"never":"هرگز","immediately":"فورا","after_30_seconds":"پس از 30 ثانیه","after_1_minute":"پس از 1 دقیقه","after_2_minutes":"پس از 2 دقیقه","after_3_minutes":"پس از 3 دقیقه","after_4_minutes":"پس از 4 دقیقه","after_5_minutes":"پس از 5 دقیقه","after_10_minutes":"پس از 10 دقیقه"},"notification_level_when_replying":"وقتی به یک موضوع پاسخ می‌دهم، وضعیت آن موضوع را تغییر بده به ","invited":{"search":"بنویسید تا دعوت‌ها را جستجو کنید...","title":"دعوت‌ها","user":"کاربر دعوت شده","none":"هیچ دعوتنامه ای برای نمایش نیست","truncated":{"one":"نمایش {{count}} دعوت اول.","other":"نمایش {{count}} دعوت اول."},"redeemed":"دعوت‌نامه‌های استفاده شده","redeemed_tab":"استفاده شده","redeemed_tab_with_count":"({{count}}) استفاده شده","redeemed_at":"استفاده شده","pending":"دعوت‌های در انتظار","pending_tab":"در انتظار","pending_tab_with_count":"({{count}}) در انتظار","topics_entered":"موضوعات بازدید شده","posts_read_count":"نوشته‌های خوانده شده","expired":"این دعوت منقضی شده است.","rescind":"پاک کردن","rescinded":"دعوت حذف شد","rescind_all":"تمام دعوتنامه های منقضی شده را پاک کن","rescinded_all":"تمام دعوت نامه های منقضی شده حذف شدند!","rescind_all_confirm":"مطمئنی می‌خواهی تمام دعوتنامه های منقضی شده را پاک کنی؟","reinvite":"ارسال دوباره دعوت","reinvite_all":"ارسال مجدد تمام دعوت‌ها","reinvite_all_confirm":"آیا از ارسال مجدد تمامی دعوت‌ها اطمینان دارید؟","reinvited":"دعوتنامه دوباره ارسال شد","reinvited_all":"تمام دعوت‌ها دوباره ارسال شدند!","time_read":"زمان خواندن","days_visited":"روز های بازدید شده","account_age_days":"عمر حساب بر اساس روز","create":"فرستادن یک دعوتنامه","generate_link":"کپی لینک دعوت","link_generated":"لینک دعوت با موفقیت ایجاد شد!","valid_for":"لینک دعوت فقط برای این ایمیل معتبر است: %{email}","bulk_invite":{"none":"هنوز کسی را دعوت نکرده‌اید. افراد را یکی یکی یا یک جا با \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eفایل CSV\u003c/a\u003e دعوت کنید.","text":"دعوت گروهی از طریق فایل","success":"فایل با موفقیت بارگذاری شد٬ وقتی که پروسه تمام شد به شما را از طریق پیام اطلاع می دهیم. ","error":"با عرض پوزش، نوع فایل باید CSV باشد.","confirmation_message":"میخواهید به همه ی افراد فایل اپلود شده دعوتنامه بفرستید"}},"password":{"title":"رمزعبور","too_short":"رمز عبورتان خیلی کوتاه است","common":"رمز عبور خیلی ساده است","same_as_username":"رمز عبورتان با نام کاربری شما برابر است.","same_as_email":"رمز عبورتان با ایمیل شما برابر است. ","ok":"رمز عبور خوبی است.","instructions":"حداقل %{count} نویسه"},"summary":{"title":"خلاصه","stats":"آمار","time_read":" زمان خواندن","recent_time_read":"زمان خواندن اخیر","topic_count":{"one":"موضوعات ساخته شدند","other":"موضوعات ساخته شدند"},"post_count":{"one":"نوشته‌ها ساخته شدند","other":"نوشته‌ها ساخته شدند"},"likes_given":{"one":"داده شده","other":"داده شده"},"likes_received":{"one":"دریافت شده","other":"دریافت شده"},"days_visited":{"one":"روز‌هایی که بازدید شده","other":"روز‌هایی که بازدید شده"},"topics_entered":{"one":"مبحث بازدید شده","other":"مباحث بازدید شده"},"posts_read":{"one":"نوشته‌های خوانده شده","other":"نوشته‌های خوانده شده"},"bookmark_count":{"one":"نشانک‌ها","other":"نشانک‌ها"},"top_replies":"بالا‌ترین پاسخ‌ها","no_replies":"بدون پاسخ","more_replies":"پاسخ‌های بیشتر","top_topics":"برترین موضوعات","no_topics":"بدون موضوع.","more_topics":"موضوعات بیشتر","top_badges":"نشان‌های برتر","no_badges":"بدون نشان.","more_badges":"نشان‌های بیشتر","top_links":"برترین پیوند‌ها","no_links":"بدون پیوند","most_liked_by":"بیشترین پسندیده شده توسط","most_liked_users":"بیشترین پسندیده شده","most_replied_to_users":"بیشترین پاسخ به","no_likes":"بدون پسندیده شدن.","top_categories":"داغ ترین دسته بندی ها","topics":"موضوعات","replies":"پاسخ‌ها"},"ip_address":{"title":"آخرین نشانی IP"},"registration_ip_address":{"title":"نشانی IP ثبت‌نامی"},"avatar":{"title":"عکس نمایه","header_title":"نمایه، پیام‌ها، نشانک‌ها و تنظیمات شخصی"},"title":{"title":"عنوان","none":"(هیچی)"},"primary_group":{"title":"گروه اصلی","none":"(هیچی)"},"filters":{"all":"همه"},"stream":{"posted_by":"نوشته شده توسط:","sent_by":"ارسال شده توسط:","private_message":"پیام","the_topic":"موضوع"}},"loading":"بارگذاری...","errors":{"prev_page":"هنگام تلاش برای بارگذاری","reasons":{"network":"خطای شبکه","server":"خطای سرور","forbidden":"دسترسی قطع شده است","unknown":"خطا","not_found":"صفحه پیدا نشد"},"desc":{"network":"ارتباط اینترنتی‌تان را بررسی کنید.","network_fixed":"به نظر می رسد درست شد!","server":"کد خطا: {{status}}","forbidden":"شما اجازه دیدن آن را ندارید.","not_found":"اوه, برنامه سعی کرد پیوندی را که وجود ندارد باز کند.","unknown":"اشتباهی روی داد."},"buttons":{"back":"برگشت","again":"تلاش دوباره","fixed":"بارگذاری برگه"}},"modal":{"close":"بسته"},"close":"بستن","assets_changed_confirm":"این وب سایت به روز رسانی شده است. برای دیدن آخرین نسخه تازه‌سازی می‌کنید؟","logout":"شما از سایت خارج شده‌اید.","refresh":"تازه کردن","read_only_mode":{"enabled":"سایت در حال فقط خواندنی است. می‌توانید موضوعات را مشاهده کنید ولی امکان ارسال پاسخ، پسندیدن و سایر عملیات در حال حاضر غیر‌فعال است.","login_disabled":"ورود به سیستم غیر فعال شده همزمان با اینکه سایت در حال فقط خواندنی است.","logout_disabled":"سایت در حال فقط خواندنی است و امکان خروج در این حالت وجود ندارد."},"logs_error_rate_notice":{},"learn_more":"بیشتر بدانید...","all_time":"مجموع","all_time_desc":"مجموع موضوعات ایجاد شده","year":"سال","year_desc":"موضوعاتی که در 365 روز گذشته ایحاد شده‌اند","month":"ماه","month_desc":"موضوعاتی که در 30 روز گذشته ساخته شده اند","week":"هفته","week_desc":"موضوعاتی که در 7 روز گذشته باز شده‌اند","day":"روز","first_post":"نوشته نخست","mute":"بی‌صدا","unmute":"صدادار","last_post":"ارسال شده","time_read":"خواندن","time_read_recently":"اخیراً","time_read_tooltip":"%{time_read} مجموع زمان خواندن ","time_read_recently_tooltip":"%{time_read} زمان مطالعه کل (%{recent_time_read}در ۶۰ روز گذشته)","last_reply_lowercase":"آخرین پاسخ","replies_lowercase":{"one":"پاسخ","other":"پاسخ‌ها "},"signup_cta":{"sign_up":"ثبت نام","hide_session":"فردا به من یادآوری کن","hide_forever":"نه ممنون","hidden_for_session":"باشه, فردا از شما سؤال میکنم. شما همیشه میتوانید از 'ورود' نیز برای ساخت حساب کاربری استفاده کنید.","intro":"سلام! :heart_eyes: به نظر میاد شما از بحث لذت می‌برید، اما هنوز برای یک حساب کاربری ثبت نام نکرده‌اید.","value_prop":"وقتی یک حساب کاربری بسازید، دقیقا به جایی که پیشتر مطالعه می‌کردید برمی‌گردید. در ضمن وقتی کسی به شما پاسخ داد، آگاه‌سازی ایمیلی هم دریافت می‌کنید. و می‌توانید نوشته‌های خوب را لایک کنید و محبت را در فضا توسعه دهید :heartpulse:"},"summary":{"enabled_description":"شما خلاصه ای از این موضوع را می بینید: بالاترین‌ نوشته‌هایی که توسط انجمن انتخاب شده.","description":"\u003cb\u003e{{replyCount}}\u003c/b\u003e پاسخ وجود دارد.","description_time":" \u003cb\u003e{{replyCount}}\u003c/b\u003e پاسخ با زمان برآورد شده \u003cb\u003e{{readingTime}} دقیقه\u003c/b\u003e برای خواندن وجود دارد.","enable":"خلاصه‌ی این موضوع","disable":"نمایش همه‌ی نوشته‌ها"},"deleted_filter":{"enabled_description":"این موضوع شامل نوشته‌های حذف شده‌ای است، که مخفی شده‌اند.","disabled_description":"نوشته‌های حذف شده در موضوع نمایش داده می‌شوند.","enable":"مخفی کردن نوشته‌های حذف شده","disable":"نشان دادن نوشته‌های حذف شده"},"private_message_info":{"title":"پیام","invite":"فراخواندن دیگران ...","edit":"حذف یا اضافه ... ","leave_message":"واقعا میخواهید این پیام را ترک کنید؟","remove_allowed_user":"آیا واقعا می خواهید اسم {{name}} از پیام برداشته شود ؟ ","remove_allowed_group":"آیا از حذف {{name}} از این پیام اطمینان دارید؟"},"email":"ایمیل","username":"نام‌کاربری","last_seen":"مشاهده شد","created":"ساخته شده","created_lowercase":"ساخته شده","trust_level":"سطح اعتماد","search_hint":"نام کاربری ، ایمیل یا ای پی ","create_account":{"disclaimer":"با ثبت نام شما با \u003ca href='{{privacy_link}}' target='blank'\u003eحریم خصوصی\u003c/a\u003e و \u003ca href='{{tos_link}}' target='blank'\u003eشرایط و ضوابط استفاده از سرویس \u003c/a\u003e موافقت کرده اید.","title":"ساختن حساب‌کاربری جدید","failed":"اشتباهی روی داده، شاید این نام کاربری پیش‌تر استفاده شده؛ پیوند فراموشی گذرواژه می‌تواند کمک کند."},"forgot_password":{"title":"باز‌یابی رمز‌عبور","action":"رمز عبورم را فراموش کرده‌ام","invite":"نام‌کاربری و نشانی ایمیل خود را وارد کنید، و ما ایمیل بازیابی رمز‌عبور را برایتان ارسال خواهیم کرد.","reset":"باز‌یابی رمز‌عبور","complete_username":"اگر حساب کاربری شما با نام کاربری \u003cb\u003e%{username}\u003c/b\u003e همخوانی داشته باشد، بزودی یک ایمیل با دستورالعمل بازیابی رمز دریافت می‌کنید.","complete_email":"اگر حساب کاربری شما با نام کاربری \u003cb\u003e%{email}\u003c/b\u003eهمخوانی داشته باشد، بزودی یک ایمیل با دستورالعمل بازیابی رمز دریافت می‌کنید.","complete_username_not_found":"هیچ حساب کاربری که با \u003cb\u003e%{username}\u003c/b\u003e همخوانی داشته باشد پیدا نشد","complete_email_not_found":"هیچ حساب کاربری که \u003cb\u003e%{email}\u003c/b\u003e همخوانی داشته باشد پیدا نشد","help":"رایانامه دریافت نکرده‌اید؟ ابتدا پوشهٔ اسپم را بررسی کنید.\u003cp\u003eمطمئن نیستید از کدام آدرس رایانامه استفاده کرده‌اید؟ یک آدرس رایانامه وارد کنید تا درصورت موجود بودن به شما بگوییم.\u003c/p\u003e\u003cp\u003eاگر به آدرس رایانامهٔ حساب کاربری خود دسترسی ندارید با \u003ca href='%{basePath}/about'\u003eکارکنان ما\u003c/a\u003e تماس بگیرید.\u003c/p\u003e ","button_ok":"اوکی","button_help":"کمک"},"email_login":{"link_label":"یک لینک ورود به من ایمیل کن","button_label":"با ایمیل","complete_username":"اگر حساب کاربری با نام کاربری \u003cb\u003e%{username}\u003c/b\u003e وجود داشته باشد، شما الان یک ایمیل با لینک ورود دریافت می‌کنید.","complete_email":"اگر حساب کاربری با \u003cb\u003e%{email}\u003c/b\u003e وجود داشته باشد، شما الان یک لینک ورود دریافت می‌کنید.","complete_username_found":"یک حساب کاربری با نام کاربری \u003cb\u003e%{username}\u003c/b\u003e پیدا کردیم، شما الان یک ایمیل با لینک ورود دریافت می‌کنید.","complete_email_found":"یک حساب کاربری با \u003cb\u003e%{email}\u003c/b\u003e پیدا کردیم، شما الان یک ایمیل با لینک ورود دریافت می‌کنید.","complete_username_not_found":"هیچ حساب کاربری که با \u003cb\u003e%{username}\u003c/b\u003e همخوانی داشته باشد پیدا نشد","complete_email_not_found":"هیچ حساب کاربری که \u003cb\u003e%{email}\u003c/b\u003e همخوانی داشته باشد پیدا نشد","confirm_title":"ورود به %{site_name}","logging_in_as":"ورود با %{email}","confirm_button":"اتمام ورود"},"login":{"title":"ورود","username":"کاربر","password":"رمز‌عبور","second_factor_title":"احراز هویت دو مرحله ای","second_factor_description":"لطفا کد احراز هویت از اپ را وارد کنید:","second_factor_backup":"ورود با استفاده از یک کد پشتیبان","second_factor_backup_title":"پشتیبان دو عامله","second_factor_backup_description":"لطفا یکی از کدهای پشتیبان را وارد کنید:","security_key_authenticate":"تأیید اعتبار با کلید امنیتی","security_key_not_allowed_error":"روند تأیید اعتبار کلید امنیتی به پایان رسیده است یا لغو شده است.","email_placeholder":"ایمیل یا نام‌کاربری","caps_lock_warning":"Caps Lock روشن است","error":"خطای ناشناخته","cookies_error":"بروسر شما به نظر کوکی را غیرفعال کرده است. بدون فعالسازی آن نمیتوانید ورود کنید.","rate_limit":"لطفا قبل از ورود مجدد اندکی صبر کنید","blank_username":"لطفا ایمیل یا نام کاربری خود را وارد کنید","blank_username_or_password":"لطفا نام‌کاربری یا ایمیل خود ، و رمز‌عبور وارد نمایید.","reset_password":"باز‌یابی رمز عبور","logging_in":"در حال ورود...","or":"یا","authenticating":"اعتبارسنجی...","awaiting_activation":"حساب‌کاربری شما در انتظار فعالسازی‌ است، برای ارسال مجدد ایمیل فعالسازی از گزینه فراموشی رمز عبور استفاده کنید.","awaiting_approval":"هنوز همکاران حساب کاربری شما را تأیید نکرده‌اند. پس از تأیید، یک ایمیل دریافت خواهید کرد.","requires_invite":"متأسفیم، دسترسی به این انجمن تنها با دعوت امکان دارد.","not_activated":"هنوز امکان ورود وجود ندارد. برای شما یک ایمیل فعالسازی به \u003cb\u003e{{sentTo}}\u003c/b\u003e فرستادیم. برای فعال‌سازی شناسه‌تان لطفاً دستورالعمل ایمیل را دنبال کنید.","not_allowed_from_ip_address":"شما نمی توانید با این آدرس آیپی وارد شوید.","admin_not_allowed_from_ip_address":"شما نمی تواند با این آدرس آیپی وارد بخش مدیریت شوید.","resend_activation_email":"برای ارسال مجدد ایمیل فعالسازی، اینجا را کلیک کنید.","omniauth_disallow_totp":"در حساب کاربری شما، احراز هویت دوعامله فعال است. لطفا با کلمه عبور خود وارد شوید.","resend_title":"ارسال مجدد ایمیل فعالسازی","change_email":"تغییر ایمیل","provide_new_email":"یک ایمیل جدید وارد کنید و ما ایمیل فعالسازی را برایتان ارسال می‌کنیم.","submit_new_email":"تغییر ایمیل","sent_activation_email_again":"ایمیل فعال‌سازی دیگری را به نشانی \u003cb\u003e{{currentEmail}}\u003c/b\u003e فرستادیم. ممکن است چند دقیقه طول بکشد؛ مطمئن شوید که پوشه اسپم را نیز بررسی کنید.","sent_activation_email_again_generic":"یک ایمیل فعالسازی دیگر فرستادیم. رسیدن آن ممکن است چند دقیقه طول بکشد؛ لطفا پوشه‌ی اسپم را هم چک کنید.","to_continue":"لطفا وارد شوید","preferences":"شما باید وارد شوید تا بتوانید تنظیمات کاربری خود را تغییر بدهید.","forgot":"من اطلاعات حساب کاربری خود را به یاد نمی‌آورم","not_approved":"حساب کاربری شما هنوز تایید نشده. بعد از تایید با ایمیل به شما اطلاع داده خواهد شد.","google_oauth2":{"name":"گوگل","title":"با گوگل"},"twitter":{"name":"توئیتر","title":"با توییتر"},"instagram":{"name":"اینستاگرام","title":"با اینستاگرام"},"facebook":{"name":"فیس بوک","title":"با فیسبوک"},"github":{"name":"گیت هاب","title":"با گیت‌هاب"},"discord":{"name":"دیسکورد"},"second_factor_toggle":{"backup_code":"به جای آن از یک کد پشتیبان استفاده کنید"}},"invites":{"accept_title":"دعوت‌نامه","welcome_to":"به %{site_name} خوش آمدید!","invited_by":"توسط این شخص دعوت شده‌اید:","social_login_available":"شما می‌توانید به شبکه‌های اجتماعی که از ایمیل فعلی شما استفاده می‌کنند وارد شوید.","your_email":"ایمیل شما: \u003cb\u003e%{email}\u003c/b\u003e.","accept_invite":"پذیرفتن دعوت","success":"حساب‌کاربری شما با موفقیت ایجاد شد و می‌توانید وارد سایت شوید.","name_label":"نام","password_label":"تنظیم رمز عبور","optional_description":"(اختیاری)"},"password_reset":{"continue":"برو به %{site_name}"},"emoji_set":{"apple_international":"اپل/جهانی","google":"گوگل","twitter":"توئیتر","win10":"ویندوز 10","google_classic":"گوگل کلاسیک","facebook_messenger":"پیامرسان فیس بوک"},"category_page_style":{"categories_only":"فقط دسته‌بندی‌ها","categories_with_featured_topics":"دسته‌بندی هایی که دارای موضوعات برجسته هستند","categories_and_latest_topics":"دسته‌بندی‌ها و آخرین موضوعات","categories_and_top_topics":"دسته بندی ها و مباحث داغ","categories_boxes":"باکس هایی با زیر دسته بندی ها","categories_boxes_with_topics":"باکس هایی با مباحث ویژه"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt","enter":"وارد شدن "},"conditional_loading_section":{"loading":"بارگذاری..."},"category_row":{"topic_count":"{{count}} مبحث در این دسته بندی"},"select_kit":{"default_header_text":"انتخاب...","no_content":"چیزی یافت نشد.","filter_placeholder":"جستجو...","filter_placeholder_with_any":"جستجو کنید یا بسازید ... ","create":"بسازید `{{content}}`","max_content_reached":{"one":"شما فقط {{count}}مورد میتوانید انتخاب کنید","other":"شما فقط {{count}} مورد میتوانید انتخاب کنید"},"min_content_not_reached":{"one":"لطفا حداقل {{count}} ایتم را انتخاب کنید","other":"لطفا حداقل {{count}}ایتم را انتخاب کنید"}},"date_time_picker":{"from":"از طرف","to":"به"},"emoji_picker":{"filter_placeholder":"جستجوی شکلک","smileys_\u0026_emotion":"احساس ها و لبخندها","people_\u0026_body":"افراد و بدن","animals_\u0026_nature":"حیوانات و طبیعت","food_\u0026_drink":"غذا و نوشیدنی","travel_\u0026_places":"مسافرت و مکان ها","activities":"فعالیت ها","objects":"اشیا","symbols":"نشانه ها","flags":"پرچم‌ها","recent":"اخیرا استفاده شده","default_tone":"بدون رنگ خاص","light_tone":"رنگ پوست روشن","medium_light_tone":"رنگ پوست متوسط روشن","medium_tone":"رنگ پوست روشن","medium_dark_tone":"رنگ پوست روشن تیره","dark_tone":"رنگ پوست تیره","default":"ایموجی های مخصوص"},"shared_drafts":{"title":"درفت مشترک","notice":"این موضوع فقط برای افرادی که به دسته بندی \u003cb\u003e{{category}}\u003c/b\u003eدسترسی دارند نمایش داده می‌شود.","destination_category":"دسته بندی مقصد","publish":"درفت مشترک را منتشر کن","confirm_publish":"از انتشار درفت مطمئنید؟","publishing":"مبحث در حال انتشار"},"composer":{"emoji":"شکلک :)","more_emoji":"بیشتر...","options":"گزینه‌ها","whisper":"زمزمه","unlist":"از فهرست پاک شده","blockquote_text":"نقل‌قول","add_warning":"این یک هشدار رسمی است.","toggle_whisper":"تغییر وضعیت زمزمه","toggle_unlisted":"تغییر وضعیت از لیست خارج شده","posting_not_on_topic":"به کدام موضوع می‌خواهید پاسخ دهید؟","saved_local_draft_tip":"به صورت محلی ذخیره شد","similar_topics":"موضوع شما شبیه است به...","drafts_offline":"پیش نویس آفلاین","edit_conflict":"ویرایش تناقض","group_mentioned":{"one":"با اشاره به {{group}}، به \u003ca href='{{group_link}}'\u003e{{count}} نفر\u003c/a\u003e اطلاعیه ارسال می‌شود. مطمئن هستید؟","other":"با اشاره به {{group}}، به \u003ca href='{{group_link}}'\u003e{{count}} نفر\u003c/a\u003e اطلاعیه ارسال می‌شود. مطمئن هستید؟"},"cannot_see_mention":{"category":"شما به {{username}} اشاره کردید ولی ایشان به دلیل نداشتن دسترسی به این دسته‌بندی، مطلع نخواهند شد. برای دسترسی باید آن‌ها را به گروهی که به این دسته‌بندی دسترسی دارند اضافه کنید.","private":"شما به {{username}} اشاره کردید ولی به دلیل نداشتن دسترسی به این پیام خصوصی مطلع نخواهند شد. برای دسترسی باید آن‌ها را به این پیام خصوصی دعوت کنید."},"duplicate_link":"به نظر می‌رسد پیوند شما به \u003cb\u003e{{domain}}\u003c/b\u003e قبلاً در یک مبحث توسط \u003cb\u003e@ {{username}}\u003c/b\u003e در \u003ca href='{{post_url}}'\u003eپاسخ به {{ago}} ارسال شده است\u003c/a\u003e - مطمئن هستید که می خواهید دوباره آن را بفرستید؟","error":{"title_missing":"عنوان الزامی است","title_too_short":"عنوان دست‌کم باید {{min}} نویسه باشد","title_too_long":"عنوان نمی‌تواند بیش‌تر از {{max}} نویسه باشد","post_missing":"فرسته نمی‌تواند خالی باشد.","post_length":"نوشته باید دست‌کم {{min}} نویسه داشته باشد","try_like":"دکمه‌ی {{heart}} را امتحان کرده‌اید؟ ","category_missing":"باید یک دسته‌بندی انتخاب کنید","tags_missing":"شما باید حداقل {{count}}برچسب انتخاب کنید"},"save_edit":"ذخیره ویرایش","overwrite_edit":"بازنویسی ویرایش","reply_original":"پاسخ دادن در موضوع اصلی","reply_here":"در اینجا پاسخ دهید","reply":"پاسخ","cancel":"لغو کردن","create_topic":"ایجاد موضوع","create_pm":"پیام","create_whisper":"زمزمه","create_shared_draft":"ایجاد پیش‌نویس مشترک","edit_shared_draft":"ویرایش درفت مشترک","title":"یا Ctrl+Enter را بفشارید","users_placeholder":"افزودن یک کاربر","title_placeholder":"در یک جمله‌ی کوتاه بگویید که این موضوع در چه موردی است؟","title_or_link_placeholder":"عنوان را بنویسید،یا پیوند را بچسبانید","edit_reason_placeholder":"چرا ویرایش می‌کنید؟","topic_featured_link_placeholder":"پیوندی که با عنوان نمایش داده می‌شود را وارد کنید.","remove_featured_link":"حذف لینک از موضوع","reply_placeholder":"اینجا بنویسید. برای قالب‌بندی متن از Markdown،‏ BBCode یا HTML استفاده کنید. عکس‌ها را به اینجا بکشید یا بچسبانید.","reply_placeholder_no_images":"اینجا بنویسید. از Markdown ,BBCode, یا HTML برای قالب بندی استفاده کنید.","reply_placeholder_choose_category":"قبل از نوشتن در اینجا یک دسته بندی انتخاب کنید","view_new_post":"نوشته جدیدتان را ببینید.","saving":"در‌حال ذخیره","saved":"ذخیره شد!","uploading":"بارگذاری...","show_preview":"نشان دادن پیش‌نمایش \u0026laquo;","hide_preview":"\u0026raquo; پنهان کردن پیش‌نمایش","quote_post_title":"نقل‌قول کل نوشته","bold_label":"B","bold_title":"ضخیم","bold_text":"نوشته‌ی ضخیم ","italic_label":"I","italic_title":"تاکید","italic_text":"متن تاکید شده","link_title":"فرا‌پیوند","link_description":"توضیحات لینک را اینجا وارد کنید.","link_dialog_title":"افزودن پیوند","link_optional_text":"عنوان اختیاری","quote_title":"نقل‌قول","quote_text":"نقل‌قول","code_title":"متن قالب‌بندی شده","code_text":"متن قالب‌بندی شده را با 4 فاصله دندانه‌دار کن","paste_code_text":"کد را در اینجا بنویسید یا بچسبانید","upload_title":"بارگذاری","upload_description":"توضیح بارگذاری را در اینجا بنویسید","olist_title":"فهرست شماره گذاری شده","ulist_title":"فهرست نقطه‌ای","list_item":"فهرست موارد","toggle_direction":"تغییر جهت","help":"راهنمای ویرایش با Markdown","collapse":"کوچک سازی پنل نوشتن","open":"پنل کامپوزر را باز کنید","abandon":"پنل نوشتن را ببند و پیش‌نویس را حذف کن","enter_fullscreen":"کامپوزر تمام صفحه","exit_fullscreen":"خارج شدن از حالت نوشتار تمام‌صفحه","modal_ok":"تایید","modal_cancel":"لغو","cant_send_pm":"متاسفانه , شما نمیتوانید به %{username} پیام بفرستید.","yourself_confirm":{"title":"آیا اضافه کردن دریافت‌کنندگان را فراموش کردید؟","body":"در حال حاضر این پیام فقط به خود شما ارسال می‌شود!"},"admin_options_title":"تنظیمات اختیاری مدیران برای این موضوع","composer_actions":{"reply":"پاسخ","draft":"درفت","edit":"ویرایش","reply_to_post":{"label":"پاسخ به پست %{postNumber} توسط %{postUsername}","desc":"پاسخ به یک پست خاص"},"reply_as_new_topic":{"label":"پاسخ به تاپیک لینک شده","desc":"ساخت تاپیک جدید، لینک شده به این تاپیک"},"reply_as_private_message":{"label":"پیام جدید","desc":"یک پیام شخصی جدید بساز"},"reply_to_topic":{"label":"پاسخ به مبحث","desc":"به مبحث اصلی پاسخ بده و نه هیچ کدام از نوشته ها"},"toggle_whisper":{"label":"فعالسازی زمزمه","desc":"زمزمه ها فقط توسط کارکنان قابل مشاهده است"},"create_topic":{"label":"موضوع جدید"},"shared_draft":{"label":"درفت اشتراکی","desc":"درفت یک مبحث که تنها توسط کارکنان قابل مشاهده است"},"toggle_topic_bump":{"label":"فعالسازی بالا آوردن مبحث در لیست","desc":"بدون تغییر زمان اخرین پاسخ، پاسخ دهید."}},"details_title":"خلاصه","details_text":"این متن پنهان خواهد شد"},"notifications":{"tooltip":{"regular":{"one":"{{count}} اعلان دیده نشده","other":"{{count}} اعلان دیده نشده"},"message":{"one":"{{count}} خوانده نشده","other":"{{count}} خوانده نشده"}},"title":"اطلاع‌رسانی‌های اشاره به @نام، پاسخ به نوشته‌ها، موضوعات، پیام‌های شما و ...","none":"قادر به بارگیری اعلان‌ها در این زمان نیستیم.","empty":"اعلانی پیدا نشد.","post_approved":"نوشته ی شما تایید شد","reviewable_items":"موارد نیازمند بازبینی است","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","liked_2":"\u003cspan\u003e{{username}}،{{username2}}\u003c/span\u003e{{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}،{{username2}}و %{count} دیگر\u003c/span\u003e{{description}}","other":"\u003cspan\u003e{{username}}،{{username2}}و {{count}} دیگر\u003c/span\u003e{{description}}"},"liked_consolidated_description":{"one":"{{count}}نوشته ی شما را پسندید","other":"{{count}}نوشته ی شما را پسندید"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003eدعوت شما را پذیرفت","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e منتقل کرد {{description}}","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","granted_badge":"به دست آوردید '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e{{description}}","watching_first_post":"\u003cspan\u003eمبحث جدید\u003c/span\u003e{{description}}","membership_request_accepted":"عضویت در {{group_name}} پذیرفته‌شد","group_message_summary":{"one":"{{count}}پیام در اینباکس {{group_name}}","other":"{{count}}پیام در اینباکس {{group_name}}"},"popup":{"mentioned":"{{username}} در \"{{topic}}\" - {{site_title}} به شما اشاره کرد","group_mentioned":"{{username}} به شما در \"{{topic}}\" - {{site_title}} اشاره نمود","quoted":"{{username}} از شما در \"{{topic}}\" - {{site_title}} نقل قول کرد ","replied":"{{username}} در \"{{topic}}\" - {{site_title}} به شما پاسخ داد","posted":"{{username}} در \"{{topic}}\" - {{site_title}} مطلبی نوشت","private_message":"{{username}} برای شما یک پیام خصوصی در \"{{topic}}\" - {{site_title}} ارسال کرد","linked":"{{username}} در \"{{topic}}\" - {{site_title}} به نوشته‌ی شما پیوندی قرار داد","watching_first_post":"{{username}} یک مبحث جدید در \"{{topic}}\" - {{site_title}} ساخته","confirm_title":"اعلانات فعال شد - %{site_title}","confirm_body":"موفق شدید. اگاهسازی‌ها فعال شدند.","custom":"اعلان از طرف {{username}} بر روی %{site_title}"},"titles":{"mentioned":"احضار شده","replied":"پاسخ جدید","quoted":"نقل قول","edited":"ویرایش شده","liked":"لایک جدید","private_message":"پیام جدید","invited_to_private_message":"به پیام دعوت شده","invitee_accepted":"پذیرفتن دعوت","posted":"پاسخ جدید","moved_post":"نوشته جابجا شده","linked":"لینک شده","granted_badge":"اهدای نشان","invited_to_topic":"به موضوع دعوت شدید.","group_mentioned":"گروه احضار شده","group_message_summary":"پیام گروهی جدید","watching_first_post":"موضوع جدید","topic_reminder":"اگاهسازی مبحث","liked_consolidated":"لایک جدید","post_approved":"نوشته تایید شده"}},"upload_selector":{"title":"افزودن تصویر","title_with_attachments":"افزودن یک تصویر یا پرونده","from_my_computer":"از دستگاه من","from_the_web":"از وب","remote_tip":"پیوند به تصویر","remote_tip_with_attachments":"پیوند به عکس یا فایل {{authorized_extensions}}","local_tip":"عکس ها را از روی سیستم خود انتخاب کنید","local_tip_with_attachments":"عکس ها یا فایل ها را از دستگاه خود انتخاب کنید {{authorized_extensions}}","hint":"(برای آپلود می توانید فایل را کشیده و در ویرایشگر متن رها کنید)","hint_for_supported_browsers":"شما همچنین میتوانید عکس ها را به داخل ویرایشگر بکشید و رها کنید یا کپی کنید","uploading":"در حال بروز‌رسانی ","select_file":"انتخاب فایل","default_image_alt_text":"تصویر"},"search":{"sort_by":"مرتب سازی بر اساس","relevance":"ارتباطات","latest_post":"آخرین ارسال","latest_topic":"آخرین موضوعات","most_viewed":"بیشترین بازدید شده","most_liked":"بیشترین پسندیده شده","select_all":"انتخاب همه","clear_all":"پاک کردن همه","too_short":"کلمه جستجو شده بسیار کوتاه است","title":"جستجوی موضوعات، نوشته‌ها، کاربران یا دسته‌‌بندی‌ها","full_page_title":"جستجوی مبحث یا نوشته","no_results":"چیزی یافت نشد.","no_more_results":"نتایجی بیشتری یافت نشد.","searching":"در حال جستجو...","post_format":"#{{post_number}} توسط {{username}}","results_page":"نتایج جستجو برای '{{term}}'","more_results":"نتایج بیشتری موجود است. لطفاً معیارهای جست‌وجوی خود را محدودتر کنید.","cant_find":"چیزی را که به دنبالش بودید نیافتید؟","start_new_topic":"شاید باید یک موضوع جدید را شروع کنید؟","or_search_google":"یا به‌جای این، جست‌وجو با گوگل را امتحان کنید:","search_google":"به‌جای این، جست‌وجو با گوگل را امتحان کنید:","search_google_button":"گوگل","search_google_title":"جستجو در سایت","context":{"user":"جستجوی نوشته‌ها با @{{username}}","category":"جستجوی دسته‌بندی #{{category}}","topic":"جستجوی این موضوع","private_messages":"جستجوی پیام‌ها"},"advanced":{"title":"جستجوی پیشرفته","posted_by":{"label":"فرستنده"},"in_category":{"label":"دسته"},"in_group":{"label":"در گروه"},"with_badge":{"label":"با نشان"},"with_tags":{"label":"با برچسب"},"filters":{"label":"فقط موضوع‌ها یا فرسته‌هایی که...","title":"مطابقت فقط در عنوان باشد","likes":"پسندیده‌ام","posted":"در آن فرستاده‌ام","watching":"مشاهده می‌کنم","tracking":"پیگیری می‌کنم","private":"در پیام‌های من","bookmarks":"نشانک زده‌ام","first":"اولین فرسته هستند","pinned":"سنجاق شده‌اند","unpinned":"سنجاق نشده‌اند","seen":"خواندم","unseen":"نخوانده‌ام","wiki":"دانشنامه هستند","images":"تصویر دارند","all_tags":"تمام برچسب‌های بالا"},"statuses":{"label":"که موضوع‌ها","open":"باز هستند","closed":"بسته شده‌اند","archived":"بایگانی شده‌اند","noreplies":"پاسخی ندارند","single_user":"یک کاربر دارند"},"post":{"count":{"label":"کمترین تعداد فرسته"},"time":{"label":"ارسال شده","before":"قبل از","after":"بعد از"}}}},"hamburger_menu":"به فهرست مبحث یا دسته بندی دیگر بروید","new_item":"تازه","go_back":"برگردید","not_logged_in_user":"صفحه کاربر با خلاصه ای از فعالیت های و تنظیمات","current_user":"به صفحه‌ی کاربریتان بروید","view_all":"مشاهده همه","topics":{"new_messages_marker":"آخرین بازدید","bulk":{"select_all":"انتخاب همه","clear_all":"پاکسازی همه","unlist_topics":"از فهرست خارج کردن مباحث","relist_topics":"ایجاد فهرست مجدد از موضوعات","reset_read":"تنظیم مجدد خوانده شد","delete":"حذف موضوعات","dismiss":"پنهان کردن","dismiss_read":"پنهان کردن تمامی خوانده نشده ها","dismiss_button":"پنهان کردن...","dismiss_tooltip":"نوشته‌های جددی را ببند یا موضوعات را پیگیری نکن","also_dismiss_topics":"توقف پیگیری این موضوعات که دیگر به عنوان خوانده نشده برای من نمایش داده نشوند","dismiss_new":"بستن جدید","toggle":"تغییر وضعیت انتخاب گروهی موضوعات","actions":"عملیات گروهی","change_category":"تنظیم دسته‌بندی","close_topics":"بستن موضوعات","archive_topics":"بایگانی موضوعات","notification_level":"اعلان‌ها","choose_new_category":"یک دسته‌بندی جدید برای موضوع انتخاب نمایید","selected":{"one":"شما \u003cb\u003e{{count}}\u003c/b\u003e موضوع را انتخاب کرده اید.","other":"شما \u003cb\u003e{{count}}\u003c/b\u003e موضوع را انتخاب کرده اید."},"change_tags":"جایگزینی برچسب‌ها","append_tags":"افزودن برچسب‌ها","choose_new_tags":"انتخاب برچسب‌های جدید برای این موضوعات:","choose_append_tags":"انتخاب برچسب‌های جدید برای افزودن به این موضوعات:","changed_tags":"انتخاب برچسب برای موضوعاتی که عوض شدند"},"none":{"unread":"موضوع خوانده نشده‌ای ندارید.","new":"شما هیچ موضوع تازه‌ای ندارید","read":"هنوز هیچ موضوعی را نخوانده‌اید.","posted":"هنوز در هیچ موضوعی نوشته نگذاشته‌اید.","latest":"هیچ موضوع تازه‌ای نیست. چه بد!","bookmarks":"هنوز هیچ موضوع نشانک‌داری ندارید.","category":"هیچ موضوعی در {{category}} نیست.","top":"موضوع برتری وجود ندارد.","educate":{"new":"\u003cp\u003eموضوعات جدید در اینجا نمایش داده می‌شوند.\u003c/p\u003e\u003cp\u003eبه صورت پیشفرض موضوعات جدید با علامت \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eجدید\u003c/span\u003eنمایش داده می‌شوند\n موضوعاتی که کمتر از 2 روز از ایجادشان گذشته جدید هستند. برای تغییر این مقدار روی گزینه\u003c/p\u003e\u003cp\u003e\u003ca href=\"%{userPrefsUrl}\"\u003eتنظیمات\u003c/a\u003e کلیک کنید.\u003c/p\u003e","unread":"\u003cp\u003eموضوعات جدید در اینجا قرار می گیرند.\u003c/p\u003e\u003cp\u003eبه طور پیش فرض، موضوعات جدید در نظر گرفته خواهند شد و نشان داده می شوند \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eجدید\u003c/span\u003e شاخص اگر آنها در 2 روز گذشته ایجاد شده باشند \u003c/p\u003e\u003cp\u003eشما می توانید این را در \u003ca href=\"%{userPrefsUrl}\"\u003eتنظیمات\u003c/a\u003e\u003c/p\u003eبرای خود تغییر دهید."}},"bottom":{"latest":"موضوع تازه‌ی دیگری وجود ندارد.","posted":"هیچ موضوعات نوشته شده ای وجود ندارد","read":"موضوع خوانده شده‌ی دیگری نیست.","new":"موضوع تازه‌ی دیگری وجود ندارد.","unread":"موضوع خوانده نشده‌ی دیگری وجود ندارد.","category":"هیچ موضوع دیگری در {{category}} نیست.","top":"موضوع برتر دیگری وجود ندارد","bookmarks":"موضوع نشانک‌دار دیگری وجود ندارد."}},"topic":{"filter_to":{"one":"{{count}} نوشته در این موضوع وجود دارد","other":"{{count}} نوشته در این موضوع وجود دارد"},"create":"موضوع جدید","create_long":"ساخت یک موضوع جدید","open_draft":"بازکردن پیشنویس","private_message":"شروع یک پیام","archive_message":{"help":"انتقال پیام به بایگانی شما","title":"بایگانی"},"move_to_inbox":{"title":"انتقال به صندوق دریافت","help":"بازگرداندن پیام به صندوق دریافتی"},"edit_message":{"help":"ویرایش اولین نوشته از پیام","title":"ویرایش پیام"},"defer":{"help":"علامت به عنوان خوانده نشده","title":" واگذار کردن"},"list":"موضوعات","new":"موضوع جدید","unread":"خوانده نشده","new_topics":{"one":"{{count}} موضوعات جدید","other":"{{count}} موضوعات جدید"},"unread_topics":{"one":"{{count}} موضوع خوانده نشده","other":"{{count}} موضوع خوانده نشده"},"title":"موضوع","invalid_access":{"title":"موضوع خصوصی است","description":"متأسفیم، شما دسترسی به این موضوع ندارید!","login_required":"برای مشاهده‌ی موضوع باید وارد سیستم شوید."},"server_error":{"title":"بارگذاری موضوع ناموفق بود","description":"متأسفیم، نتوانستیم موضوع را بار‌گیری کنیم، احتمالا دلیل آن مشکل اتصال اینترنت است. لطفاً دوباره تلاش کنید. اگر مشکل پابرجا بود، به ما اطلاع دهید."},"not_found":{"title":"موضوع پیدا نشد","description":"متأسفیم، نتوانستیم آن موضوع را پیدا کنیم. شاید یکی از همکاران آن را پاک کرده؟"},"total_unread_posts":{"one":"شما {{count}} نوشته‌ی خوانده نشده در این موضوع دارید","other":"شما {{count}} نوشته‌ی خوانده نشده در این موضوع دارید"},"unread_posts":{"one":"شما {{count}} نوشته‌ی خوانده نشده قدیمی در این موضوع دارید","other":"شما {{count}} نوشته‌ی خوانده نشده قدیمی در این موضوع دارید"},"new_posts":{"one":"{{count}} نوشته‌ی جدید از آخرین خواندن شما در این موضوع وجود دارد","other":"{{count}} نوشته‌ی جدید از آخرین خواندن شما در این موضوع وجود دارد"},"likes":{"one":"{{count}} پسند به این موضوع داده شده است","other":"{{count}} پسند به این موضوع داده شده است"},"back_to_list":"بازگشت به فهرست موضوعات","options":"گزینه‌های موضوع","show_links":"نمایش پیوندهای درون این موضوع","toggle_information":" تغییر وضعیت جزئیات موضوع","read_more_in_category":"می‌خواهید بیشتر بخوانید؟موضوعات دیگر را در {{catLink}} یا {{latestLink}} مرور کنید.","read_more":"می‌خواهید بیشتر بخوانید؟ {{catLink}} یا {{latestLink}}.","group_request":"برای مشاهده این مبحث نیازمند درخواست عضویت در گروه  `{{name}}` می‌باشید","group_join":"برای مشاهده این مبحث نیازمند پیوستن به گروه `{{name}}` می‌باشید","group_request_sent":"درخواست عضویت شما در گروه ارسال شده است. در صورت پذیرش، شما مطلع خواهید شد.","unread_indicator":"هیچ کاربری آخرین فرستهٔ این مبحث را نخوانده است.","browse_all_categories":"جستوجوی همه‌ی دسته‌‌بندی‌ها","view_latest_topics":"مشاهده آخرین موضوع","suggest_create_topic":"چطور است یک موضوع بسازیم؟","jump_reply_up":"رفتن به جدید ترین پاسخ","jump_reply_down":"رفتن به پاسخ بعدی","deleted":"موضوع پاک شده است","topic_status_update":{"title":"زمانسنج مبحث","save":"تنظیم زمان‌سنج","num_of_hours":"تعداد ساعت:","remove":"حذف زمان‌سنج","publish_to":"انتشار در:","when":"در زمان:","public_timer_types":"زمانسنجهای مبحث","private_timer_types":"زمان سنج‌های مبحث های کاربر","time_frame_required":"یک بازه ی زمانی انتخاب کنید"},"auto_update_input":{"none":"انتخاب یک دوره‌زمانی","later_today":"امروز","tomorrow":"فردا","later_this_week":"این هفته","this_weekend":"آخر هفته","next_week":"هفته بعد","two_weeks":"دو هفته","next_month":"ماه بعد","two_months":"دو ماه","three_months":"سه ماه","four_months":"چهار ماه","six_months":"شش ماه","one_year":"یک سال","forever":"همیشه","pick_date_and_time":"انتخاب زمان و تاریخ","set_based_on_last_post":"بستن با توجه به آخرین نوشته"},"publish_to_category":{"title":"زمان‌بندی انتشار"},"temp_open":{"title":"باز کردن موقتی"},"auto_reopen":{"title":"باز کردن خودکار موضوع"},"temp_close":{"title":"بستن موقتی"},"auto_close":{"title":"بستن خودکار موضوع","label":"مقدار زمان بسته شدن خودکار موضوع:","error":"یک مقدار معتبر وارد کنید.","based_on_last_post":"تا زمانی آخرین پست موضوع این قدر قدیمی نشده، موضوع را نبند."},"auto_delete":{"title":"حذف خودکار موضوع"},"reminder":{"title":"یادآوری کن"},"status_update_notice":{"auto_open":"این موضوع به صورت خودکار در %{timeLeft} باز خواهد شد.","auto_close":"این موضوع به صورت خودکار در %{timeLeft} بسته خواهد شد.","auto_publish_to_category":"این موضوع در \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e منتشر می‌شود %{timeLeft}.","auto_close_based_on_last_post":"این موضوع در %{duration} بعد از آخرین پاسخ بسته خواهد شد.","auto_delete":"این موضوع به صورت خودکار در %{timeLeft} حذف می‌شود","auto_bump":"این مطلب %{timeLeft} به صورت خودکار به صدر مطالب آورده می‌شود.","auto_reminder":"درباره این موضوع به شما یادآوری خواهد شد %{timeLeft}."},"auto_close_title":"تنظیمات بستن خوکار","auto_close_immediate":{"one":"از آخرین نوشته این موضوع %{count} ساعت گذشته، بنابراین موضوع بسته می‌شود.","other":"از آخرین نوشته این موضوع %{count} ساعت گذشته، بنابراین موضوع بسته می‌شود."},"timeline":{"back":"بازگشت","back_description":"بازگشت به اولین نوشته‌ی خوانده نشده","replies_short":"%{current} از %{total}"},"progress":{"title":"پیشرفت موضوع","go_top":"بالا","go_bottom":"پایین","go":"برو","jump_bottom":"پرش به آخرین نوشته","jump_prompt":"پرش به...","jump_prompt_of":"از %{count} نوشته","jump_prompt_long":"برو به ...","jump_bottom_with_number":"رفتن به نوشته ی %{post_number}","jump_prompt_to_date":"تا تاریخ","jump_prompt_or":"یا","total":"همه نوشته‌ها","current":"نوشته‌ی کنونی"},"notifications":{"title":"بازه زمانی آگاه‌سازی از این موضوع را تغییر دهید","reasons":{"mailing_list_mode":"حالت ایمیلی فعال است، بنابراین از پاسخ‌های موضوع با ایمیل مطلع خواهید شد.","3_10":"به دلیل مشاهده‌ی یک برچسب در این موضوع، از رویداد‌های آن آگاه خواهید شد.","3_6":"به دلیل مشاهده‌ی این دسته‌بندی، اعلان دریافت خواهید کرد.","3_5":"به دلیل مشاهده‌ی این موضوع به صورت خودکار اعلان دریافت خواهید کرد.","3_2":"به دلیل مشاهده‌ی موضوع اعلان دریافت خواهید کرد.","3_1":"از آنجا که این موضوع را ساخته‌اید، از رویدادهای آن آگاه خواهید شد.","3":"از آنجا که این موضوع را مشاهده می‌کنید، از رویدادهای آن آگاه خواهید شد.","2_8":"به دلیل ارسال پیگیری این دسته‌بندی، پاسخ‌های جدید موضوع را خواهید دید.","2_4":"به دلیل ارسال نوشته در این موضوع، پاسخ‌های جدید آن را خواهید دید.","2_2":"به دلیل پیگیری این موضوع، تعداد پاسخ‌های جدید را خواهید دید.","2":"شما به دلیل \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003eخواندن این موضوع\u003c/a\u003e. تعداد پاسخ‌های جدید آن را خواهید دید.","1_2":"در صورتی که فردی با @نام به شما اشاره کند یا پاسخی دهد به شما اطلاع داده خواهد شد.","1":"در صورتی که فردی با @نام به شما اشاره کند یا پاسخی دهد، به شما اطلاع داده خواهد شد.","0_7":"شما تمام اعلان‌های این دسته‌بندی را نادیده گرفته اید","0_2":"شما تمام اعلان‌های این موضوع را نادیده گرفته اید","0":"شما تمام اعلان‌های این موضوع را نادیده گرفته اید"},"watching_pm":{"title":"در حال مشاهده","description":"هر پاسخ جدید به این پیام به اطلاع شما خواهد رسید، و تعداد پاسخ‌های جدید نیز نمایش داده خواهد شد."},"watching":{"title":"در حال مشاهده","description":"هر پاسخ جدید در این عنوان به اطلاع شما خواهد رسید، و تعداد پاسخ‌های جدید نیز نمایش داده خواهد شد."},"tracking_pm":{"title":"پیگیری","description":"تعداد پاسخ‌های جدید برای این پیام نمایش داده خواهد شد. در صورتی که فردی با @نام به شما اشاره کند یا به شما پاسخی دهد، به شما اطلاع داده خواهد شد."},"tracking":{"title":"پیگیری","description":"تعداد پاسخ‌های جدید برای این عنوان نمایش داده خواهد شد. در صورتی که فردی با @نام به شما اشاره کند یا به شما پاسخی دهد، به شما اطلاع رسانی خواهد شد."},"regular":{"title":"معمولی","description":"در صورتی که فردی با @نام به شما اشاره کند یا به شما پاسخی دهد به شما اطلاع داده خواهد شد."},"regular_pm":{"title":"معمولی","description":"در صورتی که فردی با @نام به شما اشاره کند یا به شما پاسخی دهد به شما اطلاع داده خواهد شد."},"muted_pm":{"title":"بی‌صدا شد","description":" در باره این پیام هرگز به شما اطلاع رسانی نخواهید شد"},"muted":{"title":"بی‌صدا شد","description":"شما هرگز از چیزی درباره این موضوع آگاه نمیشوید، و آن در آخرین ها نمایش داده نخواهد شد."}},"actions":{"title":"عملیات","recover":"بازیابی موضوع","delete":"پاک کردن موضوع","open":"باز کردن موضوع ","close":"بستن موضوع","multi_select":"انتخاب نوشته‌ها","timed_update":"انتخاب شمارنده موضوع","pin":"سنجاق زدن موضوع...","unpin":"برداشتن سنجاق موضوع...","unarchive":"موضوع بایگانی نشده","archive":"بایگانی کردن موضوع","invisible":"خارج کردن از فهرست","visible":"وارد کردن به فهرست","reset_read":"تنظیم مجدد خواندن داده ها","make_public":"ایجاد موضوع عمومی","make_private":"به پیام تبدیل کن","reset_bump_date":"تنظیم مجدد خواندن داده ها"},"feature":{"pin":"سنجاق زدن موضوع","unpin":"برداشتن سنجاق موضوع","pin_globally":"سنجاق کردن موضوع در سطح سراسری","make_banner":"موضوع سرصفحه","remove_banner":"حذف موضوع سرصفحه"},"reply":{"title":"پاسخ","help":"شروع ارسال پاسخ به این موضوع"},"clear_pin":{"title":"برداشتن سنجاق","help":"سنجاق وضعیت این موضوع را بردارید تا دیگر در بالای فهرست موضوعات شما دیده نشود."},"share":{"title":"اشتراک‌گذاری","extended_title":"اشتراک‌گذاری یک پیوند","help":"اشتراک‌گذاری پیوند این موضوع"},"print":{"title":"چاپ","help":"باز کردن حالت قابل چاپ موضوع"},"flag_topic":{"title":"پرچم","help":"پرچم خصوصی برای این موضوع جهت توجه یا برای ارسال آگاه سازی شخصی در باره آن.","success_message":"شما باموفقیت این موضوع را پرچم زدید"},"make_public":{"title":"تبدیل به مبحث عمومی","choose_category":"لطفا یک دسته‌بندی برای این تاپیک عمومی انتخاب کنید:"},"feature_topic":{"title":"این موضوع را برجسته کن","pin":"این موضوع را در بالای دسته‌بندی {{categoryLink}} نمایش بده تا وقتی که","confirm_pin":"در حال حاضر {{count}} موضوع سنجاق‌شده دارید. تعداد زیاد موضوع‌های سنجاق‌شده شاید کاربران جدید یا ناشناس را به زحمت بیندازد. آیا از سنجاق کردن یک موضوع دیگر در این دسته‌بندی اطمینان دارید؟","unpin":"این موضوع را از فهرست برترین‌های دسته‌بندی {{categoryLink}} حذف کن","unpin_until":"این موضوع از برترین‌های دسته‌بندی {{categoryLink}} حذف شود یا تا \u003cstrong\u003e%{until}\u003c/strong\u003eمنتظر بمانید.","pin_note":"کاربران می توانند موضوع را بصورت جداگانه برای خود از سنجاق در بیاورند","pin_validation":"برای سنجاق کردن این موضوع نیاز به یک تاریخ معین است.","not_pinned":"هیچ موضوعی در {{categoryLink}} سنجاق نشده.","already_pinned":{"one":"موضوعاتی که در حال حاضر در {{categoryLink}} سنجاق شده اند: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"موضوعاتی که در حال حاضر در {{categoryLink}} سنجاق شده اند: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"نمایش این موضوع در بالای فهرست همه موضوعات تا وقتی که","confirm_pin_globally":"شما قبلا این موضوع {{count}} را بصورت سراسری سنجاق زده‌اید. تعداد زیاد موضوع های سنجاق شده برای کاربران جدید و ناشناس می تواند سخت باشد. آیا از سنجاق کردن موضوعات به‌صورت سراری اطمینان دارید؟ ","unpin_globally":"حذف این موضوع از بالای لیست همه‌ی موضوعات.","unpin_globally_until":"حذف این موضوع از بالای لیست همه مباحث یا صبر کردن تا \u003cstrong\u003e%{until}\u003c/strong\u003e.","global_pin_note":"کاربران می توانند موضوع را بصورت جداگانه برای خود از سنجاق در بیاورند","not_pinned_globally":"هیچ موضوعی به صورت سراسری سنجاق نشده.","already_pinned_globally":{"one":"موضوعاتی که در حال حاضر به صورت سراسری سنجاق شده‌اند: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e","other":"موضوعاتی که در حال حاضر به صورت سراسری سنجاق شده‌اند: \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"این موضوع را در وارد بنر کن که در تمام صفحات در بالای صفحه نشان داده شود","remove_banner":"حذف بنری که از بالای تمام صفحات نمایش داده می شود. ","banner_note":"کاربران می توانند سر‌صفحه را با بستن آنها رد کنند. فقط یک موضوع را می توان در یک زمان به سر‌صفحه تبدیل کرد.","no_banner_exists":"هیچ موضوع سرصفحه ای وجود ندارد.","banner_exists":"در حال حاضر \u003cstrong class='badge badge-notification unread'\u003eیک موضوع سرصفحه ای\u003c/strong\u003e وجود دارد."},"inviting":"در حال دعوت...","automatically_add_to_groups":"این دعوت شامل دسترسی به این گروه‌ها نیز هست:","invite_private":{"title":"دعوت به پیام خصوصی","email_or_username":"ایمیل یا نام‌کاربری شخص دعوت شده","email_or_username_placeholder":"نشانی ایمیل یا نام‌کاربری","action":"دعوت","success":"ما آن کاربر را برای شرکت در این پیام دعوت کردیم.","success_group":"ما آن گروه را برای شرکت در این پیام دعوت کردیم.","error":"با عرض پوزش٬ خطایی در دعوت آن کاربر وجود داشت.","group_name":"نام گروه"},"controls":"کنترل‌های موضوع","invite_reply":{"title":"دعوتنامه","username_placeholder":"نام‌کاربری","action":"ارسال دعوتنامه ","help":"دعوت دیگران به این موضوع با ایمیل یا اطلاعیه‌ها","to_forum":"ما ایمیلی کوتاه برای شما می فرستیم که دوست شما با کلیک کردن بر روی لینک سریعا ملحق شود، به ورود به سیستم نیازی نیست. ","sso_enabled":"نام کاربری کسی را که می خواهید برای این موضوع دعوت کنید را وارد نمایید","to_topic_blank":"نام کاربری یا ایمیل کسی را که می خواهید برای این موضوع دعوت کنید را وارد نمایید","to_topic_email":"شما یک ایمیل آدرس وارد کردید. ما یک ایمیل خواهیم فرستاد که به دوستان شما اجازه می دهد سریعا به این موضوع پاسخ دهند.","to_topic_username":"شما نام کاربری شخصی را وارد کرده‌اید. ما این امر را به اطلاع او رسانده و او را به این موضوع دعوت می‌کنیم.","to_username":"نام کاربری شخصی که می‌خواهید او را دعوت کنید، وارد کنید. ما این امر را به اطلاع او رسانده و او را به این عنوان دعوت می‌کنیم.","email_placeholder":"name@example.com","success_email":"lما از طریق ایمیل دعوت نامه ارسال کردیم \u003cB\u003e {{emailOrUsername}} \u003c/ B\u003e. هنگامی که به دعوت شما پاسخ داده شد ما به شما اطلاع خواهیم داد.برای پی گیری به تب دعوت ها در پنل کاربری مراجعه نمایید","success_username":"ما آن کاربر را برای شرکت در این جستار دعوت کردیم.","error":"متاسفیم٬‌ ما آن شخص را نمی توانیم دعوت کنیم. شاید قبلا دعوت شده اند. (فراخوان ها تعداد محدودی دارند)","success_existing_email":"یک کاربر با رایانامه \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e وجو دارد. ما آن کاربر را برای شرکت در این مبحث دعوت کردیم."},"login_reply":"برای پاسخ دادن وارد شوید","filters":{"n_posts":{"one":"{{count}} نوشته","other":"{{count}} نوشته"},"cancel":"حذف فیلتر"},"move_to":{"title":"انتقال به","action":"انتقال به","error":"در انتقال نوشته ها خطایی رخ داد"},"split_topic":{"title":"انتقال به موضوع جدید","action":"انتقال به موضوع جدید","topic_name":"موضوع جدید","radio_label":"موضوع جدید","error":"یک مشکل در انتقال نوشته‌ها به موضوع جدید پیش آمد.","instructions":{"one":"شما در حال ایجاد موضوع جدید و افزودن \u003cb\u003e{{count}}\u003c/b\u003e نوشته انتخاب شده به آن هستید.","other":"شما در حال ایجاد موضوع جدید و افزودن \u003cb\u003e{{count}}\u003c/b\u003e نوشته انتخاب شده به آن هستید."}},"merge_topic":{"title":"انتقال به موضوع موجود","action":"انتقال به موضوع موجود","error":"یک خطا در انتقال نوشته‌ها به آن موضوع وجود داشت.","radio_label":"موضوع قدیمی","instructions":{"one":"لطفاً موضوعی را که قصد دارید تا \u003cb\u003e{{count}}\u003c/b\u003e نوشته‌ را به آن انتقال دهید، انتخاب نمایید.","other":"لطفاً موضوعی را که قصد دارید تا \u003cb\u003e{{count}}\u003c/b\u003e نوشته‌ را به آن انتقال دهید، انتخاب نمایید."}},"move_to_new_message":{"title":"انتقال به پیام جدید","action":"انتقال به پیام جدید","message_title":"پیام جدید","radio_label":"پیام جدید","participants":"مشارکت کنندگان"},"move_to_existing_message":{"title":"به پیام موجود بروید","action":"به پیام موجود بروید","radio_label":"پیام موجود","participants":"مشارکت کنندگان"},"merge_posts":{"title":"ادغام نوشته‌های انتخاب شده","action":"ادغام نوشته‌های انتخاب شده","error":"خطایی در ادغام نوشته‌های انتخاب شده رخ داده است."},"change_owner":{"title":"تغییر دادن مالک","action":"تغییر مالکیت","error":"خطایی در تغییر مالکیت نوشته‌ها وجود داشت.","placeholder":"نام‌کاربری مالک جدید"},"change_timestamp":{"title":"تغییر زمان","action":"تغییر زمان","invalid_timestamp":"زمان انتخابی نمی‌تواند در آینده باشد.","error":"خطایی در تغییر زمان موضوع وجود دارد.","instructions":"لطفا یک زمان جدید برای موضوع انتخاب کنید. ارسال‌های موضوع برای اعمال اختلاف زمانی، به روز می‌شوند."},"multi_select":{"select":"انتخاب","selected":"انتخاب شده ({{count}}) ","select_post":{"label":"انتخاب","title":"انتخاب نوشته"},"selected_post":{"label":"انتخاب شده","title":"برای حذف پست از حالت انتخاب کلیک کنید"},"select_replies":{"label":"انتخاب کردن + جواب دادن"},"delete":"حذف انتخاب شده ها","cancel":"لغو انتخاب","select_all":"انتخاب همه","deselect_all":"عدم انتخاب همه","description":{"one":"شما \u003cb\u003e{{count}}\u003c/b\u003e نوشته انتخاب کرده اید","other":"شما \u003cb\u003e{{count}}\u003c/b\u003e نوشته انتخاب کرده اید"}}},"post":{"quote_reply":"نقل‌قول","edit_reason":"دلیل:","post_number":"نوشته {{number}}","ignored":"محتوای نادیده گرفته‌شد","wiki_last_edited_on":"دانشنامه آخرین بار در این زمان ویرایش شده","last_edited_on":"نوشته آخرین بار ویرایش شده در","reply_as_new_topic":"پاسخگویی به عنوان یک موضوع لینک شده","reply_as_new_private_message":"پاسخ به عنوان پیام جدید به همین دریافت کنندگان","continue_discussion":"ادامه دادن بحث از {{postLink}}:","follow_quote":"برو به نوشته ای که نقل‌قول شده","show_full":"نمایش کامل نوشته","show_hidden":"دیدن محتوای نادیده گرفته‌شد","deleted_by_author":{"one":"(نوشته های ارسال شده توسط نویسنده،بصورت خودکار در %{count} ساعت حذف می شود مگر اینکه پرچم شود)","other":"(نوشته های ارسال شده توسط نویسنده،بصورت خودکار در %{count} ساعت حذف می شود مگر اینکه پرچم شود)"},"collapse":"جمع کردن","expand_collapse":"باز کردن/بستن","locked":"یکی از دست‌اندرکاران انجمن این پست را جهت جلوگیری از ویرایش قفل کرده است","gap":{"one":"{{count}} پاسخ پنهان را مشاهده کنید","other":"{{count}} پاسخ پنهان را مشاهده کنید"},"unread":"نوشته‌ی خوانده نشده","has_replies":{"one":"{{count}} پاسخ","other":"{{count}} پاسخ"},"has_likes_title":{"one":"{{count}} کاربر این مورد را پسندیده‌اند","other":"{{count}} کاربر این مورد را پسندیده‌اند"},"has_likes_title_only_you":"شما این نوشته را پسندیده‌اید","has_likes_title_you":{"one":"شما و {{count}} شخص دیگر این نوشته را پسندیده‌اید","other":"شما و {{count}} شخص دیگر این نوشته را پسندیده‌اید"},"errors":{"create":"متأسفیم، در ایجاد نوشته‌ی شما خطایی روی داد. لطفاً دوباره تلاش کنید.","edit":"متأسفیم، در ویرایش نوشته‌ی شما خطایی روی داد. لطفاً دوباره تلاش کنید.","upload":"متأسفیم، در بارگذاری آن پرونده خطایی روی داد. لطفاً دوباره تلاش کنید.","file_too_large":"با عرض پوزش، حجم پرونده بسیار بالاست (بالاترین حجم قابل بارگذاری {{max_size_kb}} کیلوبایت است). چرا فایل‌های حجیم را در سرویس‌های ابری بارگذاری نمی‌کنید و پیوند آن را اینجا نمی‌چسبانید؟","too_many_uploads":"متأسفیم، هر بار تنها می‌توانید یک پرونده را بار‌گذاری کنید.","too_many_dragged_and_dropped_files":"با عرض پوزش، شما فقط می‌توانید {{max}} پرونده به صورت یک‌جا بارگذاری کنید.","upload_not_authorized":"با عرض پوزش، فایلی که در حال‌ بارگذاری آن هستید مجاز نیست. (پسوند‌های قابل بارگذاری: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"با عرض پوزش، کاربران جدید نمی توانند تصویر بار‌گذاری کنند.","attachment_upload_not_allowed_for_new_user":"با عرض پوزش، کاربران جدید نمی توانند فایل پیوست بار‌گذاری کنند.","attachment_download_requires_login":"با عرض پوزش، شما برای دانلود فایل پیوست باید وارد سایت شوید."},"abandon_edit":{"no_value":"خیر، نگه دار","no_save_draft":"خیر، ذخیره پیش‌نویس"},"abandon":{"confirm":"آیا مطمئن هستید که میخواهید نوشته خود را رها کنید؟","no_value":"خیر، نگه دار","no_save_draft":"خیر، ذخیره پیش‌نویس","yes_value":"بله، رها کن"},"via_email":"این نوشته از طریق ایمیل ارسال شده است","via_auto_generated_email":"این نوشته با ایمیل خودکار ارسال شده","whisper":"این ارسال نجوای خصوصی برای مدیران است","wiki":{"about":"این نوشته یک دانشنامه است"},"archetypes":{"save":" ذخیره تنظیمات"},"few_likes_left":"با تشکر از علاقه شما! فقط امکان چند پسندیدن دیگر را برای امروز دارید.","controls":{"reply":"آغاز ساخت یک پاسخ به این نوشته","like":"پسندیدن این نوشته","has_liked":"شما این نوشته را پسندیده‌اید","read_indicator":"کاربرانی که این فرسته را خوانده‌اند.","undo_like":"برداشتن پسند","edit":"ویرایش این نوشته","edit_action":"ویرایش","edit_anonymous":"با عرض پوزش، اما شما برای ویرایش این نوشته باید وارد سیستم شوید.","flag":"پرچم خصوصی این نوشته برا رسیدگی یا ارسال پیام خصوصی در باره آن","delete":"حذف این نوشته","undelete":"بازگردانی این نوشته","share":"اشتراک گذاری پیوند این نوشته","more":"بیشتر","delete_replies":{"confirm":"ایا مایل به حذف پاسخ ها یه این پست هم هستید؟","just_the_post":"نه، تنها این نوشته"},"admin":"عملیات مدیریت نوشته","wiki":"ساخت دانشنامه","unwiki":"حذف دانشنامه","convert_to_moderator":"اضافه کردن رنگ همکاران","revert_to_regular":"حذف رنگ همکاران","rebake":"ساخت مجدد HTML","unhide":"آشکار کردن","change_owner":"تغییر مالکیت","grant_badge":"اعطای نشان","lock_post":"قفل کردن پست","lock_post_description":"ممانعت از ویرایش پست توسط فرستنده","unlock_post":"بازکردن پست","unlock_post_description":"اجازه به فرستنده پست برای ویرایش پست","delete_topic_disallowed_modal":"شما دسترسی برای حذف این مبحث را ندارید. اگر واقعاً می‌خواهید حذف شود، یک علامت همراه دلیل برای خبردار کردن مدیر ثبت کنید.","delete_topic_disallowed":"شما مجاز به حذف این تاپیک نمی‌باشید","delete_topic":"حذف موضوع","add_post_notice":"اطلاعیه کارکنان را اضافه کنید","remove_post_notice":"اطلاعیه کارکنان را پاک کنید","remove_timer":"حذف زمان‌سنج"},"actions":{"flag":"پرچم","defer_flags":{"one":"چشم‌پوشی از پرچم","other":"چشم‌پوشی از پرچم‌ها"},"undo":{"off_topic":"برداشتن پرچم","spam":"برداشتن پرچم","inappropriate":"برگرداندن پرچم","bookmark":"برداشتن نشانک","like":"برداشتن پسند"},"people":{"off_topic":"به عنوان خارج از بحث علامت‌گذاری شده","spam":"به عنوان هرزنامه نشانه گذاری شده","inappropriate":"به عنوان نامناسب نشانه گذاری شده","notify_moderators":"مدیر‌های مطلع شده","notify_user":"یک پیام ارسال شد","bookmark":"نشانه گذاری کن","like_capped":{"one":"و {{count}} نفر دیگر این را دوست داشتند","other":"و {{count}} نفر دیگر این را پسندیده‌اند."}},"by_you":{"off_topic":"شما برای این مورد پرچم خارج از بحث زدید","spam":"شما برای این مورد پرچم هرزنامه زدید","inappropriate":"شما به این موضوع پرچم نامناسب زدید","notify_moderators":"شما به این موضوع پرچم بررسی مدیریت زدید","notify_user":"شما یک پیام به این کاربر ارسال کردید","bookmark":"این نوشته را نشانک زدید","like":"شما این نوشته را پسند کردید"}},"delete":{"confirm":{"one":"آیا مطمئن هستید که می خواهید آن پست را حذف کنید؟","other":"آیا مطمئن هستید که می‌خواهید آن {{count}} فرسته را حذف کنید؟"}},"merge":{"confirm":{"one":"آیا مطمئن هستید که می خواهید آن پست ها را ادغام کنید؟","other":"آیا مطمئن هستید که می‌خواهید آن {{count}} فرسته را ادغام کنید؟"}},"revisions":{"controls":{"first":"بازبینی نخست","previous":"بازبینی قبلی","next":"بازبینی بعدی","last":"بازبینی آخر","hide":"مخفی کردن بازبینی","show":"نمایش بازبینی","revert":"بازگشت به این بازبینی","edit_wiki":"ویرایش دانشنامه","edit_post":"ویرایش نوشته","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e{{icon}}\u003cstrong\u003e{{current}}\u003c/strong\u003e/{{total}}"},"displays":{"inline":{"title":"نمایش خروجی رندر با اضافات و از بین بردن درون خطی","button":"HTML"},"side_by_side":{"title":"تفاوت‌های خروجی رندر شده را در کنار هم نمایش بده","button":"HTML"},"side_by_side_markdown":{"title":"تفاوت‌های سورس خام را در کنار هم نمایش بده","button":"متن"}}},"raw_email":{"displays":{"raw":{"title":"نمایش ایمیل به صورت متن","button":"متن"},"text_part":{"title":"نمایش قسمت متنی ایمیل","button":"متن"},"html_part":{"title":"نمایش قسمت HTML ایمیل","button":"HTML"}}},"bookmarks":{"created":"ساخته شده","name":"نام"}},"category":{"can":"can\u0026hellip; ","none":"(بدون دسته‌بندی)","all":"همه‌ی دسته‌بندی‌ها","edit":"ویرایش","edit_dialog_title":"ویرایش: %{categoryName}","view":"نمایش موضوعات در دسته‌بندی","general":"عمومی","settings":"تنظیمات","topic_template":"قالب موضوع","tags":"برچسب‌ها","tags_allowed_tags":"محدودکردن این برچسب‌ها به این دسته‌بندی:","tags_placeholder":"(اختیاری) فهرست برچسب‌های قابل استفاده","tag_groups_placeholder":"(اختیاری) لیست برچسب‌های قابل استفاده‌ی گروه","manage_tag_groups_link":"مدیریت گروه‌های برچسب اینجا","allow_global_tags_label":"اجازه‌ی برچسب‌های دیگر را هم بده","topic_featured_link_allowed":"اجازه‌ی لینک‌های برجسته در این دسته‌بندی","delete":"حذف دسته‌بندی","create":"دسته‌بندی جدید","create_long":"ایجاد یک دسته‌بندی جدید","save":"ذخیره دسته‌بندی","slug":"نام یکتا‌ی دسته‌بندی","slug_placeholder":"(اختیاری) کلمه با - جدا شده برای پیوند","creation_error":"خطایی در ساخت این دسته بروز کرد.","save_error":"خطایی در ذخیره‌ی این دسته‌بندی روی داد.","name":"نام دسته‌بندی","description":"توضیحات","topic":"دسته‌بندی موضوع","logo":"تصویر لوگو برای دسته‌بندی","background_image":"تصویر پس‌زمینه برای دسته‌بندی","badge_colors":"رنگ نشان‌ها","background_color":"رنگ پس‌زمینه","foreground_color":"رنگ پیش‌زمینه","name_placeholder":"حداکثر یک یا دو کلمه","color_placeholder":"هر رنگ وب","delete_confirm":"آیا مطمئنید که می‌خواهید این دسته‌بندی را پاک کنید؟","delete_error":"هنگام حذف دسته بندی خطایی رخ داد.","list":"فهرست دسته‌‌بندی‌ها","no_description":"لطفا برای این دسته بندی توضیحاتی اضافه نمایید.","change_in_category_topic":"ویرایش توضیحات","already_used":"این رنگ توسط یک دسته بندی دیگر گزیده شده است","security":"امنیت","special_warning":"اخطار: این دسته‌بندی از پیش تعریف شده است و تنظیمات امینتی آن قابل تغییر نیست. اگر شما نمی‌خواهید از این دسته‌بندی استفاده کنید، به جای تغییر کاربرد حذفش کنید.","images":"تصاویر","email_in":"آدرس ایمیل های دریافتی سفارشی:","email_in_allow_strangers":"تایید ایمیل ها از کاربران ناشناس بدون حساب کاربری","email_in_disabled":"ارسال موضوعات جدید با ایمیل در تنظیمات سایت غیر فعال است. برای فعال سازی موضوعات جدید را با ایمیل ارسال کنید،","email_in_disabled_click":"فعال کردن تنظیمات \"email in\".","show_subcategory_list":"تعداد دسته‌بندی‌های فرزند که بالای موضوعات این دسته‌بندی نمایش داده می‌شوند.","num_featured_topics":"تعداد موضوعاتی که در صفحه دسته‌بندی نمایش داده می‌شوند:","subcategory_num_featured_topics":"تعداد موضوعات برجسته که در دسته‌بندی مادر نمایش داده می‌شوند:","subcategory_list_style":"سبک فهرست دسته‌بندی‌های فرزند","sort_order":"فهرست موضوعات مرتب شود با:","default_view":"لیست موضوعات پیشفرض:","default_top_period":"دوره زمانی پیشفرض برترین‌ها:","allow_badges_label":"امکان اهدای نشان در این دسته‌بندی را بده","edit_permissions":"ویرایش دسترسی‌ها","review_group_name":"نام گروه","require_topic_approval":"نیازمند تاییدیه مدیریت برای تمامی تاپیک‌های جدید","require_reply_approval":"نیازمند تاییدیه مدیریت برای تمامی پاسخ‌های جدید","this_year":"امسال","position":"موقعیت در صفحه دسته‌بندی:","default_position":"موقعیت پیش‌فرض","position_disabled":"دسته‌‌بندی‌ها به‌ترتیب فعالیت نمایش داده می‌شوند. برای کنترل ترتیب دسته‌بندی‌ها","position_disabled_click":"در تنظیمات \"مکان دسته‌بندی ثابت\" را فعال کنید.","minimum_required_tags":"حداقل تعداد برچسب‌های مورد نیاز در یک تاپیک:","parent":"دسته‌بندی مادر","notifications":{"watching":{"title":"در حال تماشا","description":"شما به صورت خودکار تمام موضوعات این دسته‌بندی را مشاهده می‌کنید و از هر نوشته جدید در موضوعات آگاه خواهید شد، همچنین تعداد پاسخ‌های جدید نمایش داده می‌شوند."},"watching_first_post":{"title":"در‌حال مشاهده‌ نوشته‌ی اول"},"tracking":{"title":"پیگیری","description":"شما به صورت خودکار تمام موضوعات این دسته‌بندی را پیگیری خواهید کرد. اگر فردی به صورت @نام به نام شما اشاره کند یا به شما پاسخ دهد، تعداد پاسخ‌ها به شما نمایش داده خواهد شد. "},"regular":{"title":"معمولی","description":"در صورتی که فردی با @نام به شما اشاره کند یا به شما پاسخی دهد به شما اطلاع داده خواهد شد."},"muted":{"title":"بی‌صدا شد","description":"شما هیچ وقت از موضوعات تازه در این دسته‌بندی‌ها مطلع نمی‌شوید, و آن‌ها در فهرست آخرین‌ها نمایش داده نمیشوند."}},"search_priority":{"label":"اولویت جستجو","options":{"normal":"معمولی","ignore":"چشم پوشی","very_low":"بسیار پایین","low":"کم","high":"بالا","very_high":"بسیار بالا"}},"sort_options":{"default":"پیش‌فرض","likes":"پسند‌ها","op_likes":"پسند‌های نوشته اصلی","views":"بازدید","posts":"نوشته‌ها","activity":"فعالیت","posters":"ارسال کنندگان","category":"دسته‌بندی","created":"ایجاد شده"},"sort_ascending":"صعودی","sort_descending":"نزولی","subcategory_list_styles":{"rows":"سطر‌ها","rows_with_featured_topics":"سطر‌ها و موضوعات برجسته","boxes":"جعبه‌ها","boxes_with_featured_topics":"جعبه‌ها با موضوعات برجسته"},"settings_sections":{"general":"عمومی","moderation":"معتدل","appearance":"ظاهر","email":"ایمیل"}},"flagging":{"title":"تشکر برای کمک به نگه داشتن جامعه ما بصورت مدنی !","action":"پرچم‌گذاری نوشته","take_action":"اقدام","notify_action":"پیام","official_warning":"اخطار رسمی","delete_spammer":"پاک کردن هرزنگار","yes_delete_spammer":"بله، هرزنگار پاک شود","ip_address_missing":"(N/A)","hidden_email_address":"(مخفی)","submit_tooltip":"ثبت پرچم خصوصی","take_action_tooltip":"رسیدن سریع به آستانه پرچم، به جای انتظار برای پرچم انجمن","cant":"متأسفیم، در حال حاضر نمی‌توانید روی این نوشته پرچم بگذارید.","notify_staff":"همکاران را به صورت خصوصی مطلع کن","formatted_name":{"off_topic":"خارج از موضوع است","inappropriate":"نامناسب است","spam":"هرزنامه است"},"custom_placeholder_notify_user":"مشخص، سازنده، و همیشه مهربان باشید.","custom_placeholder_notify_moderators":"به ما اجازه دهید بدانیم شما در مورد چه چیز آن نگران هستید، و تا جای ممکن از پیوند‌ها و مثال‌های مرتبط استفاده کنید.","custom_message":{"at_least":{"one":"حداقل {{count}} نویسه وارد کنید","other":"حداقل {{count}} نویسه وارد کنید"},"more":{"one":"{{count}} نیاز است...","other":"{{count}} نیاز است..."},"left":{"one":"{{count}} باقی مانده","other":"{{count}} باقی مانده"}}},"flagging_topic":{"title":"تشکر برای کمک به جامعه مدنی انجمن ما!","action":"پرچم‌گذاری موضوع","notify_action":"پیام"},"topic_map":{"title":"چکیده موضوع","participants_title":"نویسنده‌های فعال","links_title":"لینک‌های محبوب","links_shown":"نمایش لینک‌های بیشتر...","clicks":{"one":"%{count} کلیک","other":"%{count} کلیک"}},"post_links":{"about":"توسعه پیوند‌های بیشتر برای این نوشته","title":{"one":"%{count} بیشتر","other":"%{count} بیشتر"}},"topic_statuses":{"warning":{"help":"این یک هشدار رسمی است."},"bookmarked":{"help":"این موضوع را نشانک زدید"},"locked":{"help":"این موضوع بسته شده؛ پاسخ‌های تازه اینجا پذیرفته نمی‌شوند"},"archived":{"help":"این موضوع بایگانی شده؛ قفل شده و نمی‌تواند تغییر کند."},"locked_and_archived":{"help":"این موضوع بسته و آرشیو شده; دیگر پاسخ های تازه قبول نمیکند و قابل تغییر هم نیست"},"unpinned":{"title":"سنجاق نشده","help":"این موضوع برای شما سنجاق نشده است؛ به ترتیب معمولی نمایش داده خواهد شد"},"pinned_globally":{"title":"سنجاق سراسری","help":"این موضوع به‌صورت سراسری سنجاق شده؛ در بالای آخرین‌ها و دسته‌بندی‌ها نمایش داده می‌شود"},"pinned":{"title":"سنجاق شد","help":"این موضوع برای شما سنجاق شده است، و در بالای دسته‌بندی نمایش داده خواهد شد."},"unlisted":{"help":"این موضوع از فهرست خارج شد؛ و در فهرست موضوعات نمایش داده نخواهد شد، و فقط از طریق لینک مستقیم در دسترس خواهد بود. "},"personal_message":{"title":"این تاپیک یک پیام‌خصوصی است","help":"این تاپیک یک پیام‌خصوصی است"}},"posts":"نوشته‌ها","posts_long":"این موضوع {{number}} نوشته دارد","original_post":"نوشته اصلی","views":"نمایش‌ها","views_lowercase":{"one":"بازدید","other":"بازدیدها"},"replies":"پاسخ‌ها","views_long":{"one":"این موضوع {{number}} بار دیده شده","other":"این موضوع {{number}} بار دیده شده"},"activity":"فعالیت","likes":"پسندها","likes_lowercase":{"one":"پسند‌ها","other":"پسند‌ها"},"likes_long":"{{number}} پسند در این موضوع وجود دارد","users":"کاربران","users_lowercase":{"one":"کاربران","other":"کاربران"},"category_title":"دسته","history":"تاریخچه","changed_by":"توسط {{author}}","raw_email":{"title":"ایمیل دریافتی","not_available":"در دسترس نیست!"},"categories_list":"فهرست دسته‌‌بندی‌ها","filters":{"with_topics":"%{filter} موضوعات","with_category":"%{filter} %{category} موضوعات","latest":{"title":"آخرین","title_with_count":{"one":"آخرین ({{count}})","other":"آخرین ({{count}})"},"help":"موضوعات با نوشته‌های تازه"},"read":{"title":"خواندن","help":"موضوعاتی که شما خواندید، به ترتیب آخرین خوانده شده‌ها. "},"categories":{"title":"دسته‌‌بندی‌ها","title_in":"دسته بندی - {{categoryName}}","help":"همه‌ی موضوعات در دسته‌‌بندی‌ها جای گرفتند"},"unread":{"title":"خوانده‌ نشده‌","title_with_count":{"one":" ({{count}}) خوانده‌ نشده‌","other":" ({{count}}) خوانده‌ نشده‌"},"help":"موضوعاتی که در حال حاضر مشاهده می کنید یا دنبال می کنید با نوشته های خوانده نشده","lower_title_with_count":{"one":"{{count}} خوانده نشده","other":"{{count}} خوانده نشده"}},"new":{"lower_title_with_count":{"one":"{{count}} تازه","other":"{{count}} تازه"},"lower_title":"جدید","title":"جدید","title_with_count":{"one":"({{count}}) جدید","other":"({{count}}) جدید"},"help":"موضوعات ایجاد شده در چند روز گذشته"},"posted":{"title":"نوشته‌های من","help":"موضوعاتی که در آن‌ها نوشته دارید"},"bookmarks":{"title":"نشانک‌ها","help":"موضوعاتی که نشانک زده‌اید"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} ({{count}})","other":"{{categoryName}} ({{count}})"},"help":"موضوعات تازه در دستهٔ {{categoryName}}"},"top":{"title":"برترین‌ها","help":"بیشترین موضوعات فعال در سال گذشته، ماه ، هفته یا روز","all":{"title":"تمام وقت"},"yearly":{"title":"سالیانه "},"quarterly":{"title":"چهار‌ماهه"},"monthly":{"title":"ماهیانه "},"weekly":{"title":"هفتگی"},"daily":{"title":"روزانه"},"all_time":"تمام وقت","this_year":"سال","this_quarter":"چهار‌ماه","this_month":"ماه","this_week":"هفته","today":"امروز","other_periods":"دیدن بالاترین مطالب"}},"permission_types":{"full":"ساختن / پاسخ دادن / دیدن","create_post":"پاسخ دادن / دیدن","readonly":"دیدن"},"lightbox":{"download":"دانلود","previous":"قبلی (مکان‌نمای چپ)","next":"بعدی (مکان‌نمای راست)","close":"بستن (خروج)"},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":", ","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1} یا %{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1} %{shortcut2}","title":"میانبر‌های صفحه‌کلید","jump_to":{"title":"برو به","home":"%{shortcut} خانه","latest":"%{shortcut} آخرین","new":"%{shortcut} جدید","unread":"%{shortcut} خوانده نشده","categories":"%{shortcut} دسته‌بندی‌ها","top":"%{shortcut} برترین","bookmarks":"%{shortcut} نشانه‌گذاری‌ها","profile":"%{shortcut} مشخصات","messages":"%{shortcut} پیام‌ها","drafts":"پیش‌نویس %{shortcut}"},"navigation":{"title":"ناوبری","jump":"%{shortcut} برو به نوشته #","back":"%{shortcut} عقب","up_down":"%{shortcut} برای تغییر انتخاب شده \u0026uarr; \u0026darr;","open":"%{shortcut} برای باز کردن موضوع انتخاب شده","next_prev":"%{shortcut} بخش بعدی/قبلی","go_to_unread_post":"برو به اولین پست خوانده‌نشده %{shortcut}"},"application":{"title":"برنامه","create":"ایجاد موضوع جدید","notifications":"%{shortcut} باز کردن اطلاعیه‌ها","hamburger_menu":"%{shortcut} باز کردن منو همبرگری","user_profile_menu":"%{shortcut} نمایش منو کاربری","show_incoming_updated_topics":"%{shortcut} نمایش موضوعات به‌روز شده","search":"جستجو %{shortcut}","help":"%{shortcut} باز کردن کمک صفحه‌کلید","dismiss_new_posts":"%{shortcut} بستن نوشته‌های جدید","dismiss_topics":"%{shortcut} بستن موضوعات","log_out":"%{shortcut} خروج"},"composing":{"title":"نوشتن"},"actions":{"title":"عملیات","bookmark_topic":"%{shortcut} باز کردن موضوع نشانه‌گذاری شده","pin_unpin_topic":"%{shortcut} Pin/Unpin موضوع","share_topic":"%{shortcut} اشتراک‌گذاری موضوع","share_post":"%{shortcut} اشتراک‌گذاری نوشته","reply_as_new_topic":"%{shortcut} پاسخ به عنوان موضوع مرتبط","reply_topic":"%{shortcut} پاسخ به موضوع","reply_post":"%{shortcut} پاسخ به نوشته","quote_post":"%{shortcut} نقل‌قول نوشته","like":"%{shortcut} پسندیدن نوشته","flag":"%{shortcut} علامت‌گذاری نوشته","bookmark":"%{shortcut} نشانه‌گذاری نوشته","edit":"%{shortcut} ویرایش نوشته","delete":"%{shortcut} حذف نوشته","mark_muted":"%{shortcut} بی‌صدا کردن موضوع","mark_regular":"%{shortcut} موضوع معمولی (پیشفرض)","mark_tracking":"%{shortcut} پیگیری موضوع","mark_watching":"%{shortcut} نمایش موضوع","print":"%{shortcut} چاپ موضوع","defer":"تاپیک‌های به تعویق افتاده %{shortcut}"}},"badges":{"earned_n_times":{"one":"این مدال را %{count} بار به دست آورده","other":"این مدال را %{count} بار به دست آورده"},"granted_on":"اعطا شده %{date}","others_count":"سایرین با این مدال (%{count})","title":"نشان‌ها","allow_title":"می‌توانید از این نشان برای عنوان کاربری استفاده کنید","multiple_grant":"می‌توانید این را چند بار به‌دست آورید","badge_count":{"one":"%{count} نشان","other":"%{count} نشان"},"more_badges":{"one":"+%{count} بیشتر","other":"+%{count} بیشتر"},"granted":{"one":"%{count} اعطا شده","other":"%{count} اعطا شده"},"select_badge_for_title":"انتخاب یک نشان برای استفاده در عنوان خود","none":"(هیچی)","successfully_granted":"%{badge} به %{username} با موفقیت اعطا شد","badge_grouping":{"getting_started":{"name":"شروع"},"community":{"name":"انجمن"},"trust_level":{"name":"سطح اعتماد"},"other":{"name":"دیگر"},"posting":{"name":"در حال نوشتن"}}},"tagging":{"all_tags":"تمام برچسب‌ها","other_tags":"برچسب‌های دیگر","selector_all_tags":"تمام برچسب‌ها","selector_no_tags":"بدون برچسب","changed":"برچسب‌های تغییر یافته:","tags":"برچسب‌ها","choose_for_topic":"برچسب‌های اختیاری","add_synonyms":"افزودن","delete_tag":"حذف برچسب","delete_confirm_no_topics":"ایا از حذف این برچسب مطمعن هستید؟","rename_tag":"تغییر نام برچسب","rename_instructions":"انتخاب نام جدید برای برچسب:","sort_by":"مرتب سازی بر اساس:","sort_by_count":"تعداد","sort_by_name":"نام","manage_groups":"مدیریت گروه‌های برچسب","manage_groups_description":"تعریف گروه برای سازماندهی برچسب‌ها","upload":"بارگذاری تگ‌ها","upload_successful":"تگ‌ها با موفقیت بارگذاری شد","delete_unused_confirmation":{"one":"%{count} برچسب حذف خواهد شد:%{tags}","other":"%{count} برچسب حذف خواهد شد: %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} و %{count} بیشتر","other":"%{tags}و %{count} بیشتر"},"delete_unused":"پاک کردن برچسب های استفاده نشده","delete_unused_description":"پاک کردن همه ی برچسب هایی که به هیچ مبحث یا پیامی تعلق ندارند","cancel_delete_unused":"لغو کردن","filters":{"without_category":"%{filter} %{tag} موضوعات","with_category":"%{filter} %{tag} موضوعات در %{category}","untagged_without_category":"%{filter} موضوعات بدون برچسب","untagged_with_category":"%{filter} موضوعات بدون برچسب در %{category}"},"notifications":{"watching":{"title":"در حال مشاهده","description":"به شکل اتوماتیک همه ی مباحث با این برچسب را دنبال خواهید کرد. برای همه ی نوشته ها و مباحث اگاهسازی خواهید گرفت، و تعداد نوشته های جدید و خوانده نشده در اول مبحث نمایش داده خواهد شد."},"watching_first_post":{"title":"در حال مشاهده اولین نوشته","description":"شما از مباحث جدید در این برچسب آگاهسازی می‌گیرید ولی برای نوشته ها نه."},"tracking":{"title":"پیگیری"},"regular":{"title":"عادی","description":"اگر کسی به صورت @نام به شما اشاره کند، به شما اطلاع داده خواهد شد."},"muted":{"title":"بی‌صدا شد"}},"groups":{"title":"برچسب گروه‌ها","about":"برای مدیریت راحت‌تر گروه‌ها به آن‌ها برچسب اضافه کنید.","new":"گروه جدید","tags_label":"برچسب‌های گروه:","tags_placeholder":"برچسب‌ها","parent_tag_label":"برچسب مادر:","parent_tag_placeholder":"اختیاری","parent_tag_description":"برچسب‌های این گروه تا زمانی که برچسب مادر وجود نداشته باشد، قابل استفاده نیستند.","one_per_topic_label":"محدودیت یک برچسب به ازای هر موضوع در این گروه","new_name":"گروه برچسب جدید","save":"ذخیره","delete":"حذف","confirm_delete":"آیا از حذف گروه برچسب‌ها اطمینان دارید؟","everyone_can_use":"برچسب‌ها می‌توانندتوسط همه استفاده شوند","usable_only_by_staff":"برچسب‌ها برای همه قابل مشاهده است اما تنها کارکنان می‌توانند از انها استفاده نمایند","visible_only_to_staff":"برچسب‌ها تنها برای کارکنان قابل مشاهده است"},"topics":{"none":{"unread":"شما موضوع خوانده نشده‌ای ندارید.","new":"شما موضوع جدیدی ندارید.","read":"شما هیچ موضوعی را نخوانده‌اید.","posted":"شما هیچ نوشته‌ای در موضوعات ندارید.","latest":"موضوع اخیری وجود ندارد.","bookmarks":"موضوع نشانه گذاری شده‌ای ندارید.","top":"موضوع برتری وجود ندارد."},"bottom":{"latest":"موضوع تازه دیگری وجود ندارد.","posted":"موضوع نوشته شده دیگری وجود ندارد","read":"موضوع خوانده شده دیگری وجود ندارد.","new":"موضوع جدید دیگری وجود ندارد.","unread":"موضوع خوانده نشده دیگری وجود ندارد.","top":"موضوع دیگری وجود ندارد.","bookmarks":"موضوع نشانه‌گذاری شده دیگری وجود ندارد."}}},"invite":{"custom_message_placeholder":"متن پیام خود را وارد کنید","custom_message_template_forum":"سلام، باید عضو این انجمن بشی!","custom_message_template_topic":"سلام، فکر کردم از این موضوع لذت می‌بری!"},"safe_mode":{"enabled":"حالت امن فعال شده، برای خروج از حالت امن این پنجره مرورگر را ببندید."},"poll":{"voters":{"one":"رأی دهندگان","other":"رأی دهندگان"},"total_votes":{"one":"مجموع آرا","other":"مجموع آرا"},"average_rating":"میانگین امتیاز: \u003cstrong\u003e%{average}\u003c/strong\u003e.","public":{"title":"آرا \u003cstrong\u003eعمومی\u003c/strong\u003e هستند."},"multiple":{"help":{"at_least_min_options":{"one":"حداقل \u003cstrong\u003e%{count}\u003c/strong\u003e گزینه انتخاب کنید.","other":"حداقل \u003cstrong\u003e%{count}\u003c/strong\u003e گزینه انتخاب کنید."},"up_to_max_options":{"one":"حداکثر \u003cstrong\u003e%{count}\u003c/strong\u003e گزینه انتخاب کنید","other":"حداکثر \u003cstrong\u003e%{count}\u003c/strong\u003e گزینه انتخاب کنید"},"x_options":{"one":"\u003cstrong\u003e%{count}\u003c/strong\u003e گزینه انتخاب کنید","other":"\u003cstrong\u003e%{count}\u003c/strong\u003e گزینه انتخاب کنید"},"between_min_and_max_options":"بین \u003cstrong\u003e%{min}\u003c/strong\u003e تا \u003cstrong\u003e%{max}\u003c/strong\u003e گزینه انتخاب کنید"}},"cast-votes":{"title":"انداختن رأی شما","label":"رای بدهید!"},"show-results":{"title":"نتایج نظرسنجی را نمایش بده","label":"نتایج را نشان بده"},"hide-results":{"title":"برگشتن به رای گیری "},"export-results":{"label":"خروجی گرفتن"},"open":{"title":"نظرسنجی را باز کن ","label":"باز","confirm":"آیا از باز کردن این نظرسنجی اطمینان دارید ؟ "},"close":{"title":"نظرسنجی را ببند","label":"بستن","confirm":"آیا از بستن این نظرسنجی اطمینان دارید ؟ "},"error_while_toggling_status":"متاسفانه در تغییر وضعیت این نظرسنجی، خطایی رخ داده است.","error_while_casting_votes":"متاسفانه در ثبت رای شما خطایی رخ داده است.","error_while_fetching_voters":"متاسفانه در نمایش رای دهندگان خطایی رخ داده است.","ui_builder":{"title":"ساخت نظرسنجی","insert":"درج نظر سنجی","help":{"invalid_values":"مقدار حداقل می بایست کمتر از مقدار حداکثر باشد."},"poll_type":{"label":"نوع","regular":"یک انتخابی","multiple":"چند انتخابی","number":"امتیاز عددی"},"poll_result":{"label":"نتایج"},"poll_config":{"max":"بیشترین","min":"کمترین","step":"مرحله"},"poll_public":{"label":"نمایش رای دهندگان"},"poll_options":{"label":"در هر خط یک گزینه نظرسنجی را وارد کنید"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"شروع برنامه آموزشی کاربر جدید برای تمام کاربران جدید","welcome_message":"برای تمام کاربران جدید پیام \"خوش آمدید\" به همراه راهنمای \"شروع سریع\" بفرست"}},"discourse_local_dates":{"title":"درج تاریخ / ساعت","create":{"form":{"insert":"درج کردن","advanced_mode":"حالت پیشرفته","simple_mode":"حالت ساده","format_description":"فرمت مورد استفاده نمایش تاریخ به کاربر. برای نمایش منطقه زمانی کاربر در کلمات از \"T\\Z\\\" استفاده کنید (برای مثال Europe/Paris)","timezones_title":"نمایش منطقه زمانی","recurring_title":"همروندی","recurring_none":"بدون همروندی","invalid_date":"تاریخ نامعتبر. مطمئن شوید تاریخ و زمان درست هستند.","date_title":"تاریخ","time_title":"زمان","format_title":"فرمت تاریخ","timezone":"منطقه ی زمانی"}}},"details":{"title":"مخفی کردن جزئیات"},"presence":{"replying":"در حال نوشتن پاسخ","editing":"در حال ویرایش"},"voting":{"vote_title":"امتیاز","voting_closed_title":"بسته"},"docker":{"upgrade":"Discourse نصب شده شما به روز نیست.","perform_upgrade":"برای بروز رسانی اینجا کلیک کنید."}}},"zh_CN":{"js":{"dates":{"long_no_year":"M[月]D[日] HH:mm"},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"next_business_day":"下一个工作日","start_of_next_business_week":"下周一","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"directory":{"last_updated":"最近更新："},"groups":{"requests":{"handle":"处理成员请求"}},"user":{"use_current_timezone":"使用现在的时区","staff_counters":{"rejected_posts":"被驳回的帖子"},"second_factor":{"enable_security_key_description":"当你准备好物理安全密钥后，请按下面的“注册”按钮。","totp":{"name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"already_added_error":"你已注册此安全密钥，无需再次注册。","name_required_error":"你必须提供安全密钥的名称。"}},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"change_profile_background":{"title":"个人档头部","instructions":"个人资料的页头会被居中显示且默认宽度为1110px。"},"change_featured_topic":{"instructions":"此主题的链接会显示在你的用户卡片和资料中。"},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"},"invited":{"sent":"上次发送"}},"modal":{"dismiss_error":"忽略错误"},"forgot_password":{"complete_username_found":"我们找到一个与用户名\u003cb\u003e%{username}\u003c/b\u003e匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","complete_email_found":"我们找到一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。"},"login":{"second_factor":"使用身份验证器app登录","security_key_description":"当你准备好物理安全密钥后，请按下面的“使用安全密钥进行身份验证”按钮。","security_key_alternative":"尝试另一种方式","security_key_no_matching_credential_error":"在提供的安全密钥中找不到匹配的凭据。","security_key_support_missing_error":"您当前的设备或浏览器不支持使用安全密钥。请使用其他方法。","discord":{"title":"with Discord"},"second_factor_toggle":{"totp":"改用身份验证APP"}},"emoji_set":{"emoji_one":"JoyPixels （曾用名EmojiOne）"},"select_kit":{"invalid_selection_length":"选择的字符至少为{{count}}个字符。"},"date_time_picker":{"errors":{"to_before_from":"截至日期必须晚于开始日期。"}},"composer":{"group_mentioned_limit":"\u003cb\u003e警告！\u003c/b\u003e你提到了\u003ca href='{{group_link}}'\u003e {{group}} \u003c/a\u003e，但该群组的成员数超过了的管理员配置的最大{{max}}人数。没人会收到通知。","reference_topic_title":"回复：{{title}}","error":{"topic_template_not_modified":"请通过编辑主题模板来为主题添加详情。"},"saved_draft":"正在发布草稿。点击以继续。","link_url_placeholder":"粘贴 URL 或键入以搜索主题","composer_actions":{"reply_as_new_topic":{"confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"}}},"notifications":{"tooltip":{"high_priority":{"other":"%{count}个未读的高优先级通知"}},"membership_request_consolidated":"{{count}}个加入“{{group_name}}”群组的请求","titles":{"bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}","membership_request_consolidated":"新的成员申请"}},"search":{"result_count":{"other":"\u003cspan\u003e{{count}}{{plus}}结果\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"},"context":{"tag":"搜索＃{{tag}}标签"},"advanced":{"filters":{"created":"我创建的"},"statuses":{"public":"是公开的"}}},"topic":{"feature_on_profile":{"help":"添加此主题的链接到你的用户卡片和资料中。","title":"精选到个人资料"},"remove_from_profile":{"warning":"你的个人资料中已存在精选主题。如果继续，此主题会替换存在的主题。","help":"在你的个人资料中移除指向该主题的链接","title":"从个人资料中移除"},"topic_status_update":{"num_of_days":"天数"},"auto_bump":{"title":"自动顶帖"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"move_to_new_message":{"instructions":{"other":"你正在发送\u003cb\u003e{{count}}\u003c/b\u003e篇帖子到一条新的私信/消息。"}},"move_to_existing_message":{"instructions":{"other":"请选择你要将\u003cb\u003e{{count}}\u003c/b\u003e个帖子所移动到的私信。"}},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"instructions":{"other":"请选择\u003cb\u003e@{{old_user}}\u003c/b\u003e创建的{{count}}个帖子的新作者。"},"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}},"multi_select":{"select_replies":{"title":"选择帖子及其所有回复"},"select_below":{"label":"选择 +以下","title":"选择帖子及其后的所有内容"}},"deleted_by_author":{"other":"（主题被作者撤回，除非被标记，不然将在%{count}小时后自动删除）"}},"post":{"notice":{"new_user":"这是 {{user}} 发的第一个帖子 - 让我们欢迎他加入社区！","returning_user":"从我们上一次看到 {{user}} 有一阵子了 — 他上次发帖是 {{time}}."},"abandon_edit":{"confirm":"您确定要放弃所做的更改吗？","yes_value":"是的，忽略编辑"},"controls":{"delete_replies":{"direct_replies":{"other":"是，{{count}}个直接回复"},"all_replies":{"other":"是，所有{{count}}个回复"}}},"actions":{"people":{"like":{"other":"点赞"},"read":{"other":"看过"},"read_capped":{"other":"还有{{count}}个其他用户看过"}}},"bookmarks":{"create":"创建收藏夹","edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"category":{"choose":"分类\u0026hellip;","tags_allowed_tag_groups":"限制这些标签组只能用在此分类","tags_tab_description":"上面所指定的标签和标签组仅在此分类以及其它也指定了它们的分类中可用。它们将无法在其它分类中使用。","tag_group_selector_placeholder":"（可选）标签组","required_tag_group_description":"要求新主题包含标签组中的标签：","min_tags_from_required_group_label":"标签数量：","required_tag_group_label":"标签组：","uncategorized_security_warning":"这是个特殊的分类。如果不知道应该话题属于哪个分类，那么请使用这个分类。这个分类没有安全设置。","uncategorized_general_warning":"这个分类是特殊的。它用作未选择分类的新主题的默认分类。如果你想要避免此行为并强制选择分类，\u003ca href=\"%{settingLink}\"\u003e请在此处禁用该设置\u003c/a\u003e。如果你要修改其名称或描述，请转到\u003ca href=\"%{customizeLink}\"\u003e自定义/文本内容\u003c/a\u003e。","pending_permission_change_alert":"你还没有添加%{group}到此分类；点击此按钮添加。","mailinglist_mirror":"分类镜像了一个邮件列表","all_topics_wiki":"默认将新主题设为维基主题","reviewable_by_group":"管理人员之外，可以审核该分类中的帖子和标记的人：","num_auto_bump_daily":"每天自动碰撞的主题的数量","navigate_to_first_post_after_read":"阅读主题后导航到第一个帖子","notifications":{"watching_first_post":{"description":"你将收到此分类中的新主题通知，不包括回复。"}},"sort_options":{"votes":"投票"}},"filters":{"votes":{"title":"推荐","help":"选票最多的主题"}},"browser_update":"抱歉，\u003ca href=\"http://www.discourse.com/faq/#browser\"\u003e你的浏览器版本太低，无法正常访问该站点\u003c/a\u003e。请\u003ca href=\"http://browsehappy.com\"\u003e升级你的浏览器\u003c/a\u003e。","lightbox":{"counter":"%curr% / %total%","content_load_error":"\u003ca href=\"%url%\"\u003e内容\u003c/a\u003e无法加载","image_load_error":"\u003ca href=\"%url%\"\u003e图像\u003c/a\u003e无法加载"},"keyboard_shortcuts_help":{"composing":{"return":"%{shortcut}返回编辑器","fullscreen":"%{shortcut}全屏编辑器"},"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"actions":{"topic_admin_actions":"%{shortcut}打开主题管理"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"tagging":{"info":"详情","default_info":"该标签不限于任何类别，并且没有同义词。","category_restricted":"此标签仅限于你无权访问的分类。","synonyms":"同义词","synonyms_description":"使用以下标签时，它们将被替换为\u003cb\u003e%{base_tag_name}\u003c/b\u003e 。","tag_groups_info":{"other":"此标签属于这些标签组：{{tag_groups}}。"},"category_restrictions":{"other":"只能在这些分类中使用："},"edit_synonyms":"管理同义词","add_synonyms_label":"添加同义词：","add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"},"add_synonyms_failed":"不能将以下标记添加为同义词： \u003cb\u003e%{tag_names}\u003c/b\u003e 。确保它们没有同义词并且不是其他标签的同义词。","remove_synonym":"删除同义词","delete_synonym_confirm":"您确定要删除同义词“ %{tag_name}”吗？","delete_confirm":{"other":"你确定你想要删除这个标签以及撤销在{{count}}个主题中的关联么？"},"delete_confirm_synonyms":{"other":"其{{count}}个同义词也将被删除。"},"upload_description":"上传csv文件以批量创建标签","upload_instructions":"每行一个，可选带有'tag_name，tag_group'格式的标签组。","notifications":{"tracking":{"description":"你将自动监看所有含有此标签的主题。未读和新帖的计数将显示在主题旁边。"},"muted":{"description":"你不会收到任何含有此标签的新主题的通知，也不会在未读栏。"}},"groups":{"name_placeholder":"标签组名称"}},"invite":{"custom_message":"通过编写\u003ca href\u003e自定义消息\u003c/a\u003e，使你的邀请更个性化。"},"forced_anonymous":"由于极端负载，暂时向所有人显示，已注销用户会看到它。","poll":{"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"},"vote":{"title":"结果将显示在\u003cstrong\u003e投票\u003c/strong\u003e上。"},"closed":{"title":"结果将显示一次\u003cstrong\u003e关闭\u003c/strong\u003e。"},"staff":{"title":"结果仅显示给\u003cstrong\u003e管理\u003c/strong\u003e成员。"}},"hide-results":{"label":"显示投票"},"group-results":{"title":"按用户字段分组投票","label":"显示错误"},"ungroup-results":{"title":"合并所有投票","label":"隐藏错误"},"export-results":{"title":"到处投票结果"},"automatic_close":{"closes_in":"于\u003cstrong\u003e%{timeLeft}\u003c/strong\u003e关闭。","age":"\u003cstrong\u003e%{age}\u003c/strong\u003e关闭"},"error_while_exporting_results":"抱歉，导出投票结果时出错。","ui_builder":{"help":{"options_count":"至少输入1个选项","min_step_value":"最小步长为1"},"poll_result":{"always":"总是可见","vote":"投票","closed":"关闭时","staff":"仅管理人员"},"poll_groups":{"label":"允许的群组"},"poll_chart_type":{"label":"图表类型"},"automatic_close":{"label":"自动关闭投票"}}},"discourse_local_dates":{"relative_dates":{"today":"今天%{time}","tomorrow":"明天%{time}","yesterday":"昨天%{time}","countdown":{"passed":"日期已过"}},"create":{"form":{"timezones_description":"时区将用于在预览和撤回中显示日期。","recurring_description":"定义重复事件。你还可以手动编辑表单生成的周期性选项，并使用以下键之一：年，季，月，周，日，小时，分钟，秒，毫秒。","until":"直到......","recurring":{"every_day":"每天","every_week":"每周","every_two_weeks":"每两周","every_month":"每月","every_two_months":"每两个月","every_three_months":"每三个月","every_six_months":"每六个月","every_year":"每年"}}}},"presence":{"replying_to_topic":{"other":"正在回复"}},"voting":{"title":"投票","reached_limit":"你没有选票了，先删除一张已选票！","list_votes":"显示你的投票","votes_nav_help":"选票最多的主题","voted":"你在该主题中已经投过票了","allow_topic_voting":"允许用户在此分类中为主帖点推荐","vote_title_plural":"推荐","voted_title":"已投票","voting_limit":"次数限制","votes_left":{"other":"你还有 {{count}} 张选票，查看\u003ca href='{{path}}'\u003e你的投票\u003c/a\u003e。"},"votes":{"other":"{{count}} 票"},"anonymous_button":{"other":"投票"},"remove_vote":"移除投票"},"adplugin":{"advertisement_label":"广告"}}},"en":{"js":{"user":{"change_password":{"emoji":"lock emoji"}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"notifications":{"tooltip":{"high_priority":{"one":"%{count} unread high priority notification"}}},"search":{"result_count":{"one":"\u003cspan\u003e%{count} result for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e"}},"topic":{"move_to_new_message":{"instructions":{"one":"You are about to create a new message and populate it with the post you've selected."}},"move_to_existing_message":{"instructions":{"one":"Please choose the message you'd like to move that post to."}},"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions":{"one":"Please choose a new owner for the post by \u003cb\u003e@{{old_user}}\u003c/b\u003e"},"instructions_without_old_user":{"one":"Please choose a new owner for the post"}},"deleted_by_author":{"one":"(topic withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"}},"post":{"controls":{"delete_replies":{"direct_replies":{"one":"Yes, and %{count} direct reply"},"all_replies":{"one":"Yes, and %{count} reply"}},"publish_page":"Page Publishing"},"actions":{"people":{"like":{"one":"liked this"},"read":{"one":"read this"},"read_capped":{"one":"and {{count}} other read this"}}}},"tagging":{"tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\"."},"category_restrictions":{"one":"It can only be used in this category:"},"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"delete_confirm":{"one":"Are you sure you want to delete this tag and remove it from %{count} topic it is assigned to?"},"delete_confirm_synonyms":{"one":"Its synonym will also be deleted."}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"presence":{"replying_to_topic":{"one":"replying"}},"voting":{"votes_left":{"one":"You have {{count}} vote left, see \u003ca href='{{path}}'\u003eyour votes\u003c/a\u003e."},"votes":{"one":"{{count}} vote"},"anonymous_button":{"one":"Vote"}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'fa_IR';
I18n.pluralizationRules.fa_IR = MessageFormat.locale.fa_IR;
//! moment.js

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

    var hookCallback;

    function hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isObject(input) {
        // IE8 will treat undefined and null as object if it wasn't for
        // input != null
        return input != null && Object.prototype.toString.call(input) === '[object Object]';
    }

    function isObjectEmpty(obj) {
        if (Object.getOwnPropertyNames) {
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isUndefined(input) {
        return input === void 0;
    }

    function isNumber(input) {
        return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null,
            rfc2822         : false,
            weekdayMismatch : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            var isNowValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.weekdayMismatch &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                isNowValid = isNowValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }

            if (Object.isFrozen == null || !Object.isFrozen(m)) {
                m._isValid = isNowValid;
            }
            else {
                return isNowValid;
            }
        }
        return m._isValid;
    }

    function createInvalid (flags) {
        var m = createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i = 0; i < momentProperties.length; i++) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        if (!this.isValid()) {
            this._d = new Date(NaN);
        }
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            // -0 -> 0
            return Math.ceil(number) || 0;
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                var args = [];
                var arg;
                for (var i = 0; i < arguments.length; i++) {
                    arg = '';
                    if (typeof arguments[i] === 'object') {
                        arg += '\n[' + i + '] ';
                        for (var key in arguments[0]) {
                            arg += key + ': ' + arguments[0][key] + ', ';
                        }
                        arg = arg.slice(0, -2); // Remove trailing comma and space
                    } else {
                        arg = arguments[i];
                    }
                    args.push(arg);
                }
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    hooks.suppressDeprecationWarnings = false;
    hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
        // TODO: Remove "ordinalParse" fallback in next major release.
        this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])) {
                // make sure changes to properties don't modify parent config
                res[prop] = extend({}, res[prop]);
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function calendar (key, mom, now) {
        var output = this._calendar[key] || this._calendar['sameElse'];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        ss : '%d seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    var priorities = {};

    function addUnitPriority(unit, priority) {
        priorities[unit] = priority;
    }

    function getPrioritizedUnits(unitsObj) {
        var units = [];
        for (var u in unitsObj) {
            units.push({unit: u, priority: priorities[u]});
        }
        units.sort(function (a, b) {
            return a.priority - b.priority;
        });
        return units;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (isNumber(callback)) {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PRIORITIES

    addUnitPriority('year', 1);

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                set$1(this, unit, value);
                hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get(this, unit);
            }
        };
    }

    function get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function set$1 (mom, unit, value) {
        if (mom.isValid() && !isNaN(value)) {
            if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
            }
            else {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
            }
        }
    }

    // MOMENTS

    function stringGet (units) {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units]();
        }
        return this;
    }


    function stringSet (units, value) {
        if (typeof units === 'object') {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units);
            for (var i = 0; i < prioritized.length; i++) {
                this[prioritized[i].unit](units[prioritized[i].unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function mod(n, x) {
        return ((n % x) + x) % x;
    }

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        if (isNaN(year) || isNaN(month)) {
            return NaN;
        }
        var modMonth = mod(month, 12);
        year += (month - modMonth) / 12;
        return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PRIORITY

    addUnitPriority('month', 8);

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        if (!m) {
            return isArray(this._months) ? this._months :
                this._months['standalone'];
        }
        return isArray(this._months) ? this._months[m.month()] :
            this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort :
                this._monthsShort['standalone'];
        }
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (!isNumber(value)) {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
        } else {
            return get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsShortRegex')) {
                this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsRegex')) {
                this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
        }
        for (i = 0; i < 24; i++) {
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function createDate (y, m, d, h, M, s, ms) {
        // can't just apply() to create a date:
        // https://stackoverflow.com/q/181348
        var date;
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
                date.setFullYear(y);
            }
        } else {
            date = new Date(y, m, d, h, M, s, ms);
        }

        return date;
    }

    function createUTCDate (y) {
        var date;
        // the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            var args = Array.prototype.slice.call(arguments);
            // preserve leap years using a full 400 year cycle, then reset
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
                date.setUTCFullYear(y);
            }
        } else {
            date = new Date(Date.UTC.apply(null, arguments));
        }

        return date;
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PRIORITIES

    addUnitPriority('week', 5);
    addUnitPriority('isoWeek', 5);

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 6th is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PRIORITY
    addUnitPriority('day', 11);
    addUnitPriority('weekday', 11);
    addUnitPriority('isoWeekday', 11);

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    function parseIsoWeekday(input, locale) {
        if (typeof input === 'string') {
            return locale.weekdaysParse(input) % 7 || 7;
        }
        return isNaN(input) ? null : input;
    }

    // LOCALES
    function shiftWeekdays (ws, n) {
        return ws.slice(n, 7).concat(ws.slice(0, n));
    }

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        var weekdays = isArray(this._weekdays) ? this._weekdays :
            this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
        return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
            : (m) ? weekdays[m.day()] : weekdays;
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
            : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
            : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
    }

    function handleStrictParse$1(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }

        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.

        if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
        } else {
            return this.day() || 7;
        }
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PRIORITY
    addUnitPriority('hour', 13);

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('k',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);
    addRegexToken('kk', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['k', 'kk'], function (input, array, config) {
        var kInput = toInt(input);
        array[HOUR] = kInput === 24 ? 0 : kInput;
    });
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour they want. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    var baseConfig = {
        calendar: defaultCalendar,
        longDateFormat: defaultLongDateFormat,
        invalidDate: defaultInvalidDate,
        ordinal: defaultOrdinal,
        dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
        relativeTime: defaultRelativeTime,

        months: defaultLocaleMonths,
        monthsShort: defaultLocaleMonthsShort,

        week: defaultLocaleWeek,

        weekdays: defaultLocaleWeekdays,
        weekdaysMin: defaultLocaleWeekdaysMin,
        weekdaysShort: defaultLocaleWeekdaysShort,

        meridiemParse: defaultLocaleMeridiemParse
    };

    // internal storage for locale config files
    var locales = {};
    var localeFamilies = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return globalLocale;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                var aliasedRequire = require;
                aliasedRequire('./locale/' + name);
                getSetGlobalLocale(oldLocale);
            } catch (e) {}
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
            else {
                if ((typeof console !==  'undefined') && console.warn) {
                    //warn user if arguments are passed but the locale could not be set
                    console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                }
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            var locale, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale ' +
                        'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    parentConfig = locales[config.parentLocale]._config;
                } else {
                    locale = loadLocale(config.parentLocale);
                    if (locale != null) {
                        parentConfig = locale._config;
                    } else {
                        if (!localeFamilies[config.parentLocale]) {
                            localeFamilies[config.parentLocale] = [];
                        }
                        localeFamilies[config.parentLocale].push({
                            name: name,
                            config: config
                        });
                        return null;
                    }
                }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));

            if (localeFamilies[name]) {
                localeFamilies[name].forEach(function (x) {
                    defineLocale(x.name, x.config);
                });
            }

            // backwards compat for now: also set the locale
            // make sure we set the locale AFTER all child locales have been
            // created, so we won't end up with the child locale set.
            getSetGlobalLocale(name);


            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale, tmpLocale, parentConfig = baseConfig;
            // MERGE
            tmpLocale = loadLocale(name);
            if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
            }
            config = mergeConfigs(parentConfig, config);
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function listLocales() {
        return keys(locales);
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, expectedWeekday, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }

        // check for mismatching day of week
        if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            var curWeek = weekOfYear(createLocal(), dow, doy);

            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

            // Default to current week.
            week = defaults(w.w, curWeek.week);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from beginning of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to beginning of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

    function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
        var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
        ];

        if (secondStr) {
            result.push(parseInt(secondStr, 10));
        }

        return result;
    }

    function untruncateYear(yearStr) {
        var year = parseInt(yearStr, 10);
        if (year <= 49) {
            return 2000 + year;
        } else if (year <= 999) {
            return 1900 + year;
        }
        return year;
    }

    function preprocessRFC2822(s) {
        // Remove comments and folding whitespace and replace multiple-spaces with a single space
        return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function checkWeekday(weekdayStr, parsedInput, config) {
        if (weekdayStr) {
            // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
            if (weekdayProvided !== weekdayActual) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return false;
            }
        }
        return true;
    }

    var obsOffsets = {
        UT: 0,
        GMT: 0,
        EDT: -4 * 60,
        EST: -5 * 60,
        CDT: -5 * 60,
        CST: -6 * 60,
        MDT: -6 * 60,
        MST: -7 * 60,
        PDT: -7 * 60,
        PST: -8 * 60
    };

    function calculateOffset(obsOffset, militaryOffset, numOffset) {
        if (obsOffset) {
            return obsOffsets[obsOffset];
        } else if (militaryOffset) {
            // the only allowed military tz is Z
            return 0;
        } else {
            var hm = parseInt(numOffset, 10);
            var m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
        }
    }

    // date and time from ref 2822 format
    function configFromRFC2822(config) {
        var match = rfc2822.exec(preprocessRFC2822(config._i));
        if (match) {
            var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
            if (!checkWeekday(match[1], parsedArray, config)) {
                return;
            }

            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);

            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

            getParsingFlags(config).rfc2822 = true;
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        configFromRFC2822(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        // Final attempt, use Input Fallback
        hooks.createFromInputFallback(config);
    }

    hooks.createFromInputFallback = deprecate(
        'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
        'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
        'discouraged and will be removed in an upcoming major release. Please refer to ' +
        'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // constant that refers to the ISO standard
    hooks.ISO_8601 = function () {};

    // constant that refers to the RFC 2822 form
    hooks.RFC_2822 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
        }
        if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
        }
        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._a[HOUR] <= 12 &&
            getParsingFlags(config).bigHour === true &&
            config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isDate(input)) {
            config._d = input;
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        }  else {
            configFromInput(config);
        }

        if (!isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (isUndefined(input)) {
            config._d = new Date(hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (isObject(input)) {
            configFromObject(config);
        } else if (isNumber(input)) {
            // from milliseconds
            config._d = new Date(input);
        } else {
            hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (locale === true || locale === false) {
            strict = locale;
            locale = undefined;
        }

        if ((isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)) {
            input = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
        'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other < this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

    function isDurationValid(m) {
        for (var key in m) {
            if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                return false;
            }
        }

        var unitHasDecimal = false;
        for (var i = 0; i < ordering.length; ++i) {
            if (m[ordering[i]]) {
                if (unitHasDecimal) {
                    return false; // only allow non-integers for smallest unit
                }
                if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                    unitHasDecimal = true;
                }
            }
        }

        return true;
    }

    function isValid$1() {
        return this._isValid;
    }

    function createInvalid$1() {
        return createDuration(NaN);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        this._isValid = isDurationValid(normalizedInput);

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible to translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = (string || '').match(matcher);

        if (matches === null) {
            return null;
        }

        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return minutes === 0 ?
          0 :
          parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            hooks.updateOffset(res, false);
            return res;
        } else {
            return createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime, keepMinutes) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
                if (input === null) {
                    return this;
                }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
        } else if (typeof this._i === 'string') {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
                this.utcOffset(tZone);
            }
            else {
                this.utcOffset(0, true);
            }
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

    function createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (isNumber(input)) {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])                         * sign,
                h  : toInt(match[HOUR])                         * sign,
                m  : toInt(match[MINUTE])                       * sign,
                s  : toInt(match[SECOND])                       * sign,
                ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    createDuration.fn = Duration.prototype;
    createDuration.invalid = createInvalid$1;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
        };
    }

    function addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (months) {
            setMonth(mom, get(mom, 'Month') + months * isAdding);
        }
        if (days) {
            set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
        }
        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (updateOffset) {
            hooks.updateOffset(mom, days || months);
        }
    }

    var add      = createAdder(1, 'add');
    var subtract = createAdder(-1, 'subtract');

    function getCalendarFormat(myMoment, now) {
        var diff = myMoment.diff(now, 'days', true);
        return diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
    }

    function calendar$1 (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            format = hooks.calendarFormat(this, sod) || 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        var localFrom = isMoment(from) ? from : createLocal(from),
            localTo = isMoment(to) ? to : createLocal(to);
        if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
        }
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input, units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input, units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        switch (units) {
            case 'year': output = monthDiff(this, that) / 12; break;
            case 'month': output = monthDiff(this, that); break;
            case 'quarter': output = monthDiff(this, that) / 3; break;
            case 'second': output = (this - that) / 1e3; break; // 1000
            case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
            case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
            case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
            case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
            default: output = this - that;
        }

        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function toISOString(keepOffset) {
        if (!this.isValid()) {
            return null;
        }
        var utc = keepOffset !== true;
        var m = utc ? this.clone().utc() : this;
        if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
        }
        if (isFunction(Date.prototype.toISOString)) {
            // native implementation is ~50x faster, use it when we can
            if (utc) {
                return this.toDate().toISOString();
            } else {
                return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
            }
        }
        return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }

    /**
     * Return a human readable representation of a moment that can
     * also be evaluated to get a new moment which is the same
     *
     * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
     */
    function inspect () {
        if (!this.isValid()) {
            return 'moment.invalid(/* ' + this._i + ' */)';
        }
        var func = 'moment';
        var zone = '';
        if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
            zone = 'Z';
        }
        var prefix = '[' + func + '("]';
        var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
        var datetime = '-MM-DD[T]HH:mm:ss.SSS';
        var suffix = zone + '[")]';

        return this.format(prefix + year + datetime + suffix);
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

    // actual modulo - handles negative numbers (for dates before 1970):
    function mod$1(dividend, divisor) {
        return (dividend % divisor + divisor) % divisor;
    }

    function localStartOfDate(y, m, d) {
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return new Date(y, m, d).valueOf();
        }
    }

    function utcStartOfDate(y, m, d) {
        // Date.UTC remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return Date.UTC(y, m, d);
        }
    }

    function startOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year(), 0, 1);
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                break;
            case 'month':
                time = startOfDate(this.year(), this.month(), 1);
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date());
                break;
            case 'hour':
                time = this._d.valueOf();
                time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                break;
            case 'minute':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_MINUTE);
                break;
            case 'second':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_SECOND);
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function endOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year() + 1, 0, 1) - 1;
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                break;
            case 'month':
                time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                break;
            case 'hour':
                time = this._d.valueOf();
                time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                break;
            case 'minute':
                time = this._d.valueOf();
                time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                break;
            case 'second':
                time = this._d.valueOf();
                time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return new Date(this.valueOf());
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function isValid$2 () {
        return isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PRIORITY

    addUnitPriority('weekYear', 1);
    addUnitPriority('isoWeekYear', 1);


    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PRIORITY

    addUnitPriority('quarter', 7);

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PRIORITY
    addUnitPriority('date', 9);

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        // TODO: Remove "ordinalParse" fallback in next major release.
        return isStrict ?
          (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
          locale._dayOfMonthOrdinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0]);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PRIORITY
    addUnitPriority('dayOfYear', 4);

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PRIORITY

    addUnitPriority('minute', 14);

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PRIORITY

    addUnitPriority('second', 15);

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PRIORITY

    addUnitPriority('millisecond', 16);

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var proto = Moment.prototype;

    proto.add               = add;
    proto.calendar          = calendar$1;
    proto.clone             = clone;
    proto.diff              = diff;
    proto.endOf             = endOf;
    proto.format            = format;
    proto.from              = from;
    proto.fromNow           = fromNow;
    proto.to                = to;
    proto.toNow             = toNow;
    proto.get               = stringGet;
    proto.invalidAt         = invalidAt;
    proto.isAfter           = isAfter;
    proto.isBefore          = isBefore;
    proto.isBetween         = isBetween;
    proto.isSame            = isSame;
    proto.isSameOrAfter     = isSameOrAfter;
    proto.isSameOrBefore    = isSameOrBefore;
    proto.isValid           = isValid$2;
    proto.lang              = lang;
    proto.locale            = locale;
    proto.localeData        = localeData;
    proto.max               = prototypeMax;
    proto.min               = prototypeMin;
    proto.parsingFlags      = parsingFlags;
    proto.set               = stringSet;
    proto.startOf           = startOf;
    proto.subtract          = subtract;
    proto.toArray           = toArray;
    proto.toObject          = toObject;
    proto.toDate            = toDate;
    proto.toISOString       = toISOString;
    proto.inspect           = inspect;
    proto.toJSON            = toJSON;
    proto.toString          = toString;
    proto.unix              = unix;
    proto.valueOf           = valueOf;
    proto.creationData      = creationData;
    proto.year       = getSetYear;
    proto.isLeapYear = getIsLeapYear;
    proto.weekYear    = getSetWeekYear;
    proto.isoWeekYear = getSetISOWeekYear;
    proto.quarter = proto.quarters = getSetQuarter;
    proto.month       = getSetMonth;
    proto.daysInMonth = getDaysInMonth;
    proto.week           = proto.weeks        = getSetWeek;
    proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
    proto.weeksInYear    = getWeeksInYear;
    proto.isoWeeksInYear = getISOWeeksInYear;
    proto.date       = getSetDayOfMonth;
    proto.day        = proto.days             = getSetDayOfWeek;
    proto.weekday    = getSetLocaleDayOfWeek;
    proto.isoWeekday = getSetISODayOfWeek;
    proto.dayOfYear  = getSetDayOfYear;
    proto.hour = proto.hours = getSetHour;
    proto.minute = proto.minutes = getSetMinute;
    proto.second = proto.seconds = getSetSecond;
    proto.millisecond = proto.milliseconds = getSetMillisecond;
    proto.utcOffset            = getSetOffset;
    proto.utc                  = setOffsetToUTC;
    proto.local                = setOffsetToLocal;
    proto.parseZone            = setOffsetToParsedOffset;
    proto.hasAlignedHourOffset = hasAlignedHourOffset;
    proto.isDST                = isDaylightSavingTime;
    proto.isLocal              = isLocal;
    proto.isUtcOffset          = isUtcOffset;
    proto.isUtc                = isUtc;
    proto.isUTC                = isUtc;
    proto.zoneAbbr = getZoneAbbr;
    proto.zoneName = getZoneName;
    proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
    proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

    function createUnix (input) {
        return createLocal(input * 1000);
    }

    function createInZone () {
        return createLocal.apply(null, arguments).parseZone();
    }

    function preParsePostFormat (string) {
        return string;
    }

    var proto$1 = Locale.prototype;

    proto$1.calendar        = calendar;
    proto$1.longDateFormat  = longDateFormat;
    proto$1.invalidDate     = invalidDate;
    proto$1.ordinal         = ordinal;
    proto$1.preparse        = preParsePostFormat;
    proto$1.postformat      = preParsePostFormat;
    proto$1.relativeTime    = relativeTime;
    proto$1.pastFuture      = pastFuture;
    proto$1.set             = set;

    proto$1.months            =        localeMonths;
    proto$1.monthsShort       =        localeMonthsShort;
    proto$1.monthsParse       =        localeMonthsParse;
    proto$1.monthsRegex       = monthsRegex;
    proto$1.monthsShortRegex  = monthsShortRegex;
    proto$1.week = localeWeek;
    proto$1.firstDayOfYear = localeFirstDayOfYear;
    proto$1.firstDayOfWeek = localeFirstDayOfWeek;

    proto$1.weekdays       =        localeWeekdays;
    proto$1.weekdaysMin    =        localeWeekdaysMin;
    proto$1.weekdaysShort  =        localeWeekdaysShort;
    proto$1.weekdaysParse  =        localeWeekdaysParse;

    proto$1.weekdaysRegex       =        weekdaysRegex;
    proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
    proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

    proto$1.isPM = localeIsPM;
    proto$1.meridiem = localeMeridiem;

    function get$1 (format, index, field, setter) {
        var locale = getLocale();
        var utc = createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return get$1(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = get$1(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return get$1(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = get$1(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    getSetGlobalLocale('en', {
        dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports

    hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
    hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

    var mathAbs = Math.abs;

    function abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function addSubtract$1 (duration, input, value, direction) {
        var other = createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function add$1 (input, value) {
        return addSubtract$1(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function subtract$1 (input, value) {
        return addSubtract$1(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        if (!this.isValid()) {
            return NaN;
        }
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'quarter' || units === 'year') {
            days = this._days + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            switch (units) {
                case 'month':   return months;
                case 'quarter': return months / 3;
                case 'year':    return months / 12;
            }
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function valueOf$1 () {
        if (!this.isValid()) {
            return NaN;
        }
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asQuarters     = makeAs('Q');
    var asYears        = makeAs('y');

    function clone$1 () {
        return createDuration(this);
    }

    function get$2 (units) {
        units = normalizeUnits(units);
        return this.isValid() ? this[units + 's']() : NaN;
    }

    function makeGetter(name) {
        return function () {
            return this.isValid() ? this._data[name] : NaN;
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        ss: 44,         // a few seconds to seconds
        s : 45,         // seconds to minute
        m : 45,         // minutes to hour
        h : 22,         // hours to day
        d : 26,         // days to month
        M : 11          // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
        var duration = createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds <= thresholds.ss && ['s', seconds]  ||
                seconds < thresholds.s   && ['ss', seconds] ||
                minutes <= 1             && ['m']           ||
                minutes < thresholds.m   && ['mm', minutes] ||
                hours   <= 1             && ['h']           ||
                hours   < thresholds.h   && ['hh', hours]   ||
                days    <= 1             && ['d']           ||
                days    < thresholds.d   && ['dd', days]    ||
                months  <= 1             && ['M']           ||
                months  < thresholds.M   && ['MM', months]  ||
                years   <= 1             && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set the rounding function for relative time strings
    function getSetRelativeTimeRounding (roundingFunction) {
        if (roundingFunction === undefined) {
            return round;
        }
        if (typeof(roundingFunction) === 'function') {
            round = roundingFunction;
            return true;
        }
        return false;
    }

    // This function allows you to set a threshold for relative time strings
    function getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        if (threshold === 's') {
            thresholds.ss = limit - 1;
        }
        return true;
    }

    function humanize (withSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var locale = this.localeData();
        var output = relativeTime$1(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var abs$1 = Math.abs;

    function sign(x) {
        return ((x > 0) - (x < 0)) || +x;
    }

    function toISOString$1() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var seconds = abs$1(this._milliseconds) / 1000;
        var days         = abs$1(this._days);
        var months       = abs$1(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        var totalSign = total < 0 ? '-' : '';
        var ymSign = sign(this._months) !== sign(total) ? '-' : '';
        var daysSign = sign(this._days) !== sign(total) ? '-' : '';
        var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

        return totalSign + 'P' +
            (Y ? ymSign + Y + 'Y' : '') +
            (M ? ymSign + M + 'M' : '') +
            (D ? daysSign + D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? hmsSign + h + 'H' : '') +
            (m ? hmsSign + m + 'M' : '') +
            (s ? hmsSign + s + 'S' : '');
    }

    var proto$2 = Duration.prototype;

    proto$2.isValid        = isValid$1;
    proto$2.abs            = abs;
    proto$2.add            = add$1;
    proto$2.subtract       = subtract$1;
    proto$2.as             = as;
    proto$2.asMilliseconds = asMilliseconds;
    proto$2.asSeconds      = asSeconds;
    proto$2.asMinutes      = asMinutes;
    proto$2.asHours        = asHours;
    proto$2.asDays         = asDays;
    proto$2.asWeeks        = asWeeks;
    proto$2.asMonths       = asMonths;
    proto$2.asQuarters     = asQuarters;
    proto$2.asYears        = asYears;
    proto$2.valueOf        = valueOf$1;
    proto$2._bubble        = bubble;
    proto$2.clone          = clone$1;
    proto$2.get            = get$2;
    proto$2.milliseconds   = milliseconds;
    proto$2.seconds        = seconds;
    proto$2.minutes        = minutes;
    proto$2.hours          = hours;
    proto$2.days           = days;
    proto$2.weeks          = weeks;
    proto$2.months         = months;
    proto$2.years          = years;
    proto$2.humanize       = humanize;
    proto$2.toISOString    = toISOString$1;
    proto$2.toString       = toISOString$1;
    proto$2.toJSON         = toISOString$1;
    proto$2.locale         = locale;
    proto$2.localeData     = localeData;

    proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
    proto$2.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    hooks.version = '2.24.0';

    setHookCallback(createLocal);

    hooks.fn                    = proto;
    hooks.min                   = min;
    hooks.max                   = max;
    hooks.now                   = now;
    hooks.utc                   = createUTC;
    hooks.unix                  = createUnix;
    hooks.months                = listMonths;
    hooks.isDate                = isDate;
    hooks.locale                = getSetGlobalLocale;
    hooks.invalid               = createInvalid;
    hooks.duration              = createDuration;
    hooks.isMoment              = isMoment;
    hooks.weekdays              = listWeekdays;
    hooks.parseZone             = createInZone;
    hooks.localeData            = getLocale;
    hooks.isDuration            = isDuration;
    hooks.monthsShort           = listMonthsShort;
    hooks.weekdaysMin           = listWeekdaysMin;
    hooks.defineLocale          = defineLocale;
    hooks.updateLocale          = updateLocale;
    hooks.locales               = listLocales;
    hooks.weekdaysShort         = listWeekdaysShort;
    hooks.normalizeUnits        = normalizeUnits;
    hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
    hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
    hooks.calendarFormat        = getCalendarFormat;
    hooks.prototype             = proto;

    // currently HTML5 input type only supports 24-hour formats
    hooks.HTML5_FMT = {
        DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
        DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
        DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
        DATE: 'YYYY-MM-DD',                             // <input type="date" />
        TIME: 'HH:mm',                                  // <input type="time" />
        TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
        TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
        WEEK: 'GGGG-[W]WW',                             // <input type="week" />
        MONTH: 'YYYY-MM'                                // <input type="month" />
    };

    return hooks;

})));
//! moment-timezone.js
//! version : 0.5.25
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.25",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess;

	if (!moment || typeof moment.version !== 'string') {
		logError('Moment Timezone requires Moment.js. See https://momentjs.com/timezone/docs/#/use-it/browser/');
	}

	var momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {
		
		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				var z = mom._z;
				mom.utcOffset(-offset, keepTime);
				mom._z = z;
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			if (typeof name !== 'string') {
				throw new Error('Time zone name must be a string, got ' + name + ' [' + typeof name + ']');
			}
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	function resetZoneWrap2 (old) {
		return function () {
			if (arguments.length > 0) this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName  = abbrWrap(fn.zoneName);
	fn.zoneAbbr  = abbrWrap(fn.zoneAbbr);
	fn.utc       = resetZoneWrap(fn.utc);
	fn.local     = resetZoneWrap(fn.local);
	fn.utcOffset = resetZoneWrap2(fn.utcOffset);
	
	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	loadData({
		"version": "2019a",
		"zones": [
			"Africa/Abidjan|GMT|0|0||48e5",
			"Africa/Nairobi|EAT|-30|0||47e5",
			"Africa/Algiers|CET|-10|0||26e5",
			"Africa/Lagos|WAT|-10|0||17e6",
			"Africa/Maputo|CAT|-20|0||26e5",
			"Africa/Cairo|EET EEST|-20 -30|01010|1M2m0 gL0 e10 mn0|15e6",
			"Africa/Casablanca|+00 +01|0 -10|01010101010101010101010101010101|1LHC0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00|32e5",
			"Europe/Paris|CET CEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|11e6",
			"Africa/Johannesburg|SAST|-20|0||84e5",
			"Africa/Khartoum|EAT CAT|-30 -20|01|1Usl0|51e5",
			"Africa/Sao_Tome|GMT WAT|0 -10|010|1UQN0 2q00",
			"Africa/Tripoli|EET|-20|0||11e5",
			"Africa/Windhoek|CAT WAT|-20 -10|010101010|1LKo0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
			"America/Adak|HST HDT|a0 90|01010101010101010101010|1Lzo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
			"America/Anchorage|AKST AKDT|90 80|01010101010101010101010|1Lzn0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
			"America/Santo_Domingo|AST|40|0||29e5",
			"America/Fortaleza|-03|30|0||34e5",
			"America/Asuncion|-03 -04|30 40|01010101010101010101010|1LEP0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0|28e5",
			"America/Panama|EST|50|0||15e5",
			"America/Mexico_City|CST CDT|60 50|01010101010101010101010|1LKw0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|20e6",
			"America/Managua|CST|60|0||22e5",
			"America/La_Paz|-04|40|0||19e5",
			"America/Lima|-05|50|0||11e6",
			"America/Denver|MST MDT|70 60|01010101010101010101010|1Lzl0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
			"America/Campo_Grande|-03 -04|30 40|01010101010101010101010|1LqP0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|77e4",
			"America/Cancun|CST CDT EST|60 50 50|0102|1LKw0 1lb0 Dd0|63e4",
			"America/Caracas|-0430 -04|4u 40|01|1QMT0|29e5",
			"America/Chicago|CST CDT|60 50|01010101010101010101010|1Lzk0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
			"America/Chihuahua|MST MDT|70 60|01010101010101010101010|1LKx0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0|81e4",
			"America/Phoenix|MST|70|0||42e5",
			"America/Los_Angeles|PST PDT|80 70|01010101010101010101010|1Lzm0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
			"America/New_York|EST EDT|50 40|01010101010101010101010|1Lzj0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
			"America/Fort_Nelson|PST PDT MST|80 70 70|0102|1Lzm0 1zb0 Op0|39e2",
			"America/Halifax|AST ADT|40 30|01010101010101010101010|1Lzi0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
			"America/Godthab|-03 -02|30 20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|17e3",
			"America/Grand_Turk|EST EDT AST|50 40 40|0101210101010101010|1Lzj0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
			"America/Havana|CST CDT|50 40|01010101010101010101010|1Lzh0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
			"America/Metlakatla|PST AKST AKDT|80 90 80|012121201212121212121|1PAa0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 uM0 jB0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
			"America/Miquelon|-03 -02|30 20|01010101010101010101010|1Lzh0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
			"America/Montevideo|-02 -03|20 30|0101|1Lzg0 1o10 11z0|17e5",
			"America/Noronha|-02|20|0||30e2",
			"America/Port-au-Prince|EST EDT|50 40|010101010101010101010|1Lzj0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
			"Antarctica/Palmer|-03 -04|30 40|01010|1LSP0 Rd0 46n0 Ap0|40",
			"America/Santiago|-03 -04|30 40|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|62e5",
			"America/Sao_Paulo|-02 -03|20 30|01010101010101010101010|1LqO0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0 1HB0 FX0 1HB0 IL0 1HB0 FX0 1HB0 IL0 1EN0 FX0 1HB0|20e6",
			"Atlantic/Azores|-01 +00|10 0|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|25e4",
			"America/St_Johns|NST NDT|3u 2u|01010101010101010101010|1Lzhu 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
			"Antarctica/Casey|+08 +11|-80 -b0|010|1RWg0 3m10|10",
			"Asia/Bangkok|+07|-70|0||15e6",
			"Pacific/Port_Moresby|+10|-a0|0||25e4",
			"Pacific/Guadalcanal|+11|-b0|0||11e4",
			"Asia/Tashkent|+05|-50|0||23e5",
			"Pacific/Auckland|NZDT NZST|-d0 -c0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|14e5",
			"Asia/Baghdad|+03|-30|0||66e5",
			"Antarctica/Troll|+00 +02|0 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|40",
			"Asia/Dhaka|+06|-60|0||16e6",
			"Asia/Amman|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|25e5",
			"Asia/Kamchatka|+12|-c0|0||18e4",
			"Asia/Baku|+04 +05|-40 -50|01010|1LHA0 1o00 11A0 1o00|27e5",
			"Asia/Barnaul|+07 +06|-70 -60|010|1N7v0 3rd0",
			"Asia/Beirut|EET EEST|-20 -30|01010101010101010101010|1LHy0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|22e5",
			"Asia/Kuala_Lumpur|+08|-80|0||71e5",
			"Asia/Kolkata|IST|-5u|0||15e6",
			"Asia/Chita|+10 +08 +09|-a0 -80 -90|012|1N7s0 3re0|33e4",
			"Asia/Ulaanbaatar|+08 +09|-80 -90|01010|1O8G0 1cJ0 1cP0 1cJ0|12e5",
			"Asia/Shanghai|CST|-80|0||23e6",
			"Asia/Colombo|+0530|-5u|0||22e5",
			"Asia/Damascus|EET EEST|-20 -30|01010101010101010101010|1LGK0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|26e5",
			"Asia/Dili|+09|-90|0||19e4",
			"Asia/Dubai|+04|-40|0||39e5",
			"Asia/Famagusta|EET EEST +03|-20 -30 -30|0101012010101010101010|1LHB0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Asia/Gaza|EET EEST|-20 -30|01010101010101010101010|1LGK0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0|18e5",
			"Asia/Hong_Kong|HKT|-80|0||73e5",
			"Asia/Hovd|+07 +08|-70 -80|01010|1O8H0 1cJ0 1cP0 1cJ0|81e3",
			"Asia/Irkutsk|+09 +08|-90 -80|01|1N7t0|60e4",
			"Europe/Istanbul|EET EEST +03|-20 -30 -30|0101012|1LI10 1nA0 11A0 1tA0 U00 15w0|13e6",
			"Asia/Jakarta|WIB|-70|0||31e6",
			"Asia/Jayapura|WIT|-90|0||26e4",
			"Asia/Jerusalem|IST IDT|-20 -30|01010101010101010101010|1LGM0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0|81e4",
			"Asia/Kabul|+0430|-4u|0||46e5",
			"Asia/Karachi|PKT|-50|0||24e6",
			"Asia/Kathmandu|+0545|-5J|0||12e5",
			"Asia/Yakutsk|+10 +09|-a0 -90|01|1N7s0|28e4",
			"Asia/Krasnoyarsk|+08 +07|-80 -70|01|1N7u0|10e5",
			"Asia/Magadan|+12 +10 +11|-c0 -a0 -b0|012|1N7q0 3Cq0|95e3",
			"Asia/Makassar|WITA|-80|0||15e5",
			"Asia/Manila|PST|-80|0||24e6",
			"Europe/Athens|EET EEST|-20 -30|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|35e5",
			"Asia/Novosibirsk|+07 +06|-70 -60|010|1N7v0 4eN0|15e5",
			"Asia/Omsk|+07 +06|-70 -60|01|1N7v0|12e5",
			"Asia/Pyongyang|KST KST|-90 -8u|010|1P4D0 6BA0|29e5",
			"Asia/Qyzylorda|+06 +05|-60 -50|01|1Xei0|73e4",
			"Asia/Rangoon|+0630|-6u|0||48e5",
			"Asia/Sakhalin|+11 +10|-b0 -a0|010|1N7r0 3rd0|58e4",
			"Asia/Seoul|KST|-90|0||23e6",
			"Asia/Srednekolymsk|+12 +11|-c0 -b0|01|1N7q0|35e2",
			"Asia/Tehran|+0330 +0430|-3u -4u|01010101010101010101010|1LEku 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
			"Asia/Tokyo|JST|-90|0||38e6",
			"Asia/Tomsk|+07 +06|-70 -60|010|1N7v0 3Qp0|10e5",
			"Asia/Vladivostok|+11 +10|-b0 -a0|01|1N7r0|60e4",
			"Asia/Yekaterinburg|+06 +05|-60 -50|01|1N7w0|14e5",
			"Europe/Lisbon|WET WEST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|27e5",
			"Atlantic/Cape_Verde|-01|10|0||50e4",
			"Australia/Sydney|AEDT AEST|-b0 -a0|01010101010101010101010|1LKg0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|40e5",
			"Australia/Adelaide|ACDT ACST|-au -9u|01010101010101010101010|1LKgu 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0|11e5",
			"Australia/Brisbane|AEST|-a0|0||20e5",
			"Australia/Darwin|ACST|-9u|0||12e4",
			"Australia/Eucla|+0845|-8J|0||368",
			"Australia/Lord_Howe|+11 +1030|-b0 -au|01010101010101010101010|1LKf0 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu|347",
			"Australia/Perth|AWST|-80|0||18e5",
			"Pacific/Easter|-05 -06|50 60|010101010101010101010|1LSP0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0|30e2",
			"Europe/Dublin|GMT IST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|12e5",
			"Etc/GMT-1|+01|-10|0|",
			"Pacific/Fakaofo|+13|-d0|0||483",
			"Pacific/Kiritimati|+14|-e0|0||51e2",
			"Etc/GMT-2|+02|-20|0|",
			"Pacific/Tahiti|-10|a0|0||18e4",
			"Pacific/Niue|-11|b0|0||12e2",
			"Etc/GMT+12|-12|c0|0|",
			"Pacific/Galapagos|-06|60|0||25e3",
			"Etc/GMT+7|-07|70|0|",
			"Pacific/Pitcairn|-08|80|0||56",
			"Pacific/Gambier|-09|90|0||125",
			"Etc/UTC|UTC|0|0|",
			"Europe/Ulyanovsk|+04 +03|-40 -30|010|1N7y0 3rd0|13e5",
			"Europe/London|GMT BST|0 -10|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|10e6",
			"Europe/Chisinau|EET EEST|-20 -30|01010101010101010101010|1LHA0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00|67e4",
			"Europe/Kaliningrad|+03 EET|-30 -20|01|1N7z0|44e4",
			"Europe/Kirov|+04 +03|-40 -30|01|1N7y0|48e4",
			"Europe/Moscow|MSK MSK|-40 -30|01|1N7y0|16e6",
			"Europe/Saratov|+04 +03|-40 -30|010|1N7y0 5810",
			"Europe/Simferopol|EET MSK MSK|-20 -40 -30|012|1LHA0 1nW0|33e4",
			"Europe/Volgograd|+04 +03|-40 -30|010|1N7y0 9Jd0|10e5",
			"Pacific/Honolulu|HST|a0|0||37e4",
			"MET|MET MEST|-10 -20|01010101010101010101010|1LHB0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00",
			"Pacific/Chatham|+1345 +1245|-dJ -cJ|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|600",
			"Pacific/Apia|+14 +13|-e0 -d0|01010101010101010101010|1LKe0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00|37e3",
			"Pacific/Bougainville|+10 +11|-a0 -b0|01|1NwE0|18e4",
			"Pacific/Fiji|+13 +12|-d0 -c0|01010101010101010101010|1Lfp0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0|88e4",
			"Pacific/Guam|ChST|-a0|0||17e4",
			"Pacific/Marquesas|-0930|9u|0||86e2",
			"Pacific/Pago_Pago|SST|b0|0||37e2",
			"Pacific/Norfolk|+1130 +11|-bu -b0|01|1PoCu|25e4",
			"Pacific/Tongatapu|+13 +14|-d0 -e0|010|1S4d0 s00|75e3"
		],
		"links": [
			"Africa/Abidjan|Africa/Accra",
			"Africa/Abidjan|Africa/Bamako",
			"Africa/Abidjan|Africa/Banjul",
			"Africa/Abidjan|Africa/Bissau",
			"Africa/Abidjan|Africa/Conakry",
			"Africa/Abidjan|Africa/Dakar",
			"Africa/Abidjan|Africa/Freetown",
			"Africa/Abidjan|Africa/Lome",
			"Africa/Abidjan|Africa/Monrovia",
			"Africa/Abidjan|Africa/Nouakchott",
			"Africa/Abidjan|Africa/Ouagadougou",
			"Africa/Abidjan|Africa/Timbuktu",
			"Africa/Abidjan|America/Danmarkshavn",
			"Africa/Abidjan|Atlantic/Reykjavik",
			"Africa/Abidjan|Atlantic/St_Helena",
			"Africa/Abidjan|Etc/GMT",
			"Africa/Abidjan|Etc/GMT+0",
			"Africa/Abidjan|Etc/GMT-0",
			"Africa/Abidjan|Etc/GMT0",
			"Africa/Abidjan|Etc/Greenwich",
			"Africa/Abidjan|GMT",
			"Africa/Abidjan|GMT+0",
			"Africa/Abidjan|GMT-0",
			"Africa/Abidjan|GMT0",
			"Africa/Abidjan|Greenwich",
			"Africa/Abidjan|Iceland",
			"Africa/Algiers|Africa/Tunis",
			"Africa/Cairo|Egypt",
			"Africa/Casablanca|Africa/El_Aaiun",
			"Africa/Johannesburg|Africa/Maseru",
			"Africa/Johannesburg|Africa/Mbabane",
			"Africa/Lagos|Africa/Bangui",
			"Africa/Lagos|Africa/Brazzaville",
			"Africa/Lagos|Africa/Douala",
			"Africa/Lagos|Africa/Kinshasa",
			"Africa/Lagos|Africa/Libreville",
			"Africa/Lagos|Africa/Luanda",
			"Africa/Lagos|Africa/Malabo",
			"Africa/Lagos|Africa/Ndjamena",
			"Africa/Lagos|Africa/Niamey",
			"Africa/Lagos|Africa/Porto-Novo",
			"Africa/Maputo|Africa/Blantyre",
			"Africa/Maputo|Africa/Bujumbura",
			"Africa/Maputo|Africa/Gaborone",
			"Africa/Maputo|Africa/Harare",
			"Africa/Maputo|Africa/Kigali",
			"Africa/Maputo|Africa/Lubumbashi",
			"Africa/Maputo|Africa/Lusaka",
			"Africa/Nairobi|Africa/Addis_Ababa",
			"Africa/Nairobi|Africa/Asmara",
			"Africa/Nairobi|Africa/Asmera",
			"Africa/Nairobi|Africa/Dar_es_Salaam",
			"Africa/Nairobi|Africa/Djibouti",
			"Africa/Nairobi|Africa/Juba",
			"Africa/Nairobi|Africa/Kampala",
			"Africa/Nairobi|Africa/Mogadishu",
			"Africa/Nairobi|Indian/Antananarivo",
			"Africa/Nairobi|Indian/Comoro",
			"Africa/Nairobi|Indian/Mayotte",
			"Africa/Tripoli|Libya",
			"America/Adak|America/Atka",
			"America/Adak|US/Aleutian",
			"America/Anchorage|America/Juneau",
			"America/Anchorage|America/Nome",
			"America/Anchorage|America/Sitka",
			"America/Anchorage|America/Yakutat",
			"America/Anchorage|US/Alaska",
			"America/Campo_Grande|America/Cuiaba",
			"America/Chicago|America/Indiana/Knox",
			"America/Chicago|America/Indiana/Tell_City",
			"America/Chicago|America/Knox_IN",
			"America/Chicago|America/Matamoros",
			"America/Chicago|America/Menominee",
			"America/Chicago|America/North_Dakota/Beulah",
			"America/Chicago|America/North_Dakota/Center",
			"America/Chicago|America/North_Dakota/New_Salem",
			"America/Chicago|America/Rainy_River",
			"America/Chicago|America/Rankin_Inlet",
			"America/Chicago|America/Resolute",
			"America/Chicago|America/Winnipeg",
			"America/Chicago|CST6CDT",
			"America/Chicago|Canada/Central",
			"America/Chicago|US/Central",
			"America/Chicago|US/Indiana-Starke",
			"America/Chihuahua|America/Mazatlan",
			"America/Chihuahua|Mexico/BajaSur",
			"America/Denver|America/Boise",
			"America/Denver|America/Cambridge_Bay",
			"America/Denver|America/Edmonton",
			"America/Denver|America/Inuvik",
			"America/Denver|America/Ojinaga",
			"America/Denver|America/Shiprock",
			"America/Denver|America/Yellowknife",
			"America/Denver|Canada/Mountain",
			"America/Denver|MST7MDT",
			"America/Denver|Navajo",
			"America/Denver|US/Mountain",
			"America/Fortaleza|America/Araguaina",
			"America/Fortaleza|America/Argentina/Buenos_Aires",
			"America/Fortaleza|America/Argentina/Catamarca",
			"America/Fortaleza|America/Argentina/ComodRivadavia",
			"America/Fortaleza|America/Argentina/Cordoba",
			"America/Fortaleza|America/Argentina/Jujuy",
			"America/Fortaleza|America/Argentina/La_Rioja",
			"America/Fortaleza|America/Argentina/Mendoza",
			"America/Fortaleza|America/Argentina/Rio_Gallegos",
			"America/Fortaleza|America/Argentina/Salta",
			"America/Fortaleza|America/Argentina/San_Juan",
			"America/Fortaleza|America/Argentina/San_Luis",
			"America/Fortaleza|America/Argentina/Tucuman",
			"America/Fortaleza|America/Argentina/Ushuaia",
			"America/Fortaleza|America/Bahia",
			"America/Fortaleza|America/Belem",
			"America/Fortaleza|America/Buenos_Aires",
			"America/Fortaleza|America/Catamarca",
			"America/Fortaleza|America/Cayenne",
			"America/Fortaleza|America/Cordoba",
			"America/Fortaleza|America/Jujuy",
			"America/Fortaleza|America/Maceio",
			"America/Fortaleza|America/Mendoza",
			"America/Fortaleza|America/Paramaribo",
			"America/Fortaleza|America/Recife",
			"America/Fortaleza|America/Rosario",
			"America/Fortaleza|America/Santarem",
			"America/Fortaleza|Antarctica/Rothera",
			"America/Fortaleza|Atlantic/Stanley",
			"America/Fortaleza|Etc/GMT+3",
			"America/Halifax|America/Glace_Bay",
			"America/Halifax|America/Goose_Bay",
			"America/Halifax|America/Moncton",
			"America/Halifax|America/Thule",
			"America/Halifax|Atlantic/Bermuda",
			"America/Halifax|Canada/Atlantic",
			"America/Havana|Cuba",
			"America/La_Paz|America/Boa_Vista",
			"America/La_Paz|America/Guyana",
			"America/La_Paz|America/Manaus",
			"America/La_Paz|America/Porto_Velho",
			"America/La_Paz|Brazil/West",
			"America/La_Paz|Etc/GMT+4",
			"America/Lima|America/Bogota",
			"America/Lima|America/Eirunepe",
			"America/Lima|America/Guayaquil",
			"America/Lima|America/Porto_Acre",
			"America/Lima|America/Rio_Branco",
			"America/Lima|Brazil/Acre",
			"America/Lima|Etc/GMT+5",
			"America/Los_Angeles|America/Dawson",
			"America/Los_Angeles|America/Ensenada",
			"America/Los_Angeles|America/Santa_Isabel",
			"America/Los_Angeles|America/Tijuana",
			"America/Los_Angeles|America/Vancouver",
			"America/Los_Angeles|America/Whitehorse",
			"America/Los_Angeles|Canada/Pacific",
			"America/Los_Angeles|Canada/Yukon",
			"America/Los_Angeles|Mexico/BajaNorte",
			"America/Los_Angeles|PST8PDT",
			"America/Los_Angeles|US/Pacific",
			"America/Los_Angeles|US/Pacific-New",
			"America/Managua|America/Belize",
			"America/Managua|America/Costa_Rica",
			"America/Managua|America/El_Salvador",
			"America/Managua|America/Guatemala",
			"America/Managua|America/Regina",
			"America/Managua|America/Swift_Current",
			"America/Managua|America/Tegucigalpa",
			"America/Managua|Canada/Saskatchewan",
			"America/Mexico_City|America/Bahia_Banderas",
			"America/Mexico_City|America/Merida",
			"America/Mexico_City|America/Monterrey",
			"America/Mexico_City|Mexico/General",
			"America/New_York|America/Detroit",
			"America/New_York|America/Fort_Wayne",
			"America/New_York|America/Indiana/Indianapolis",
			"America/New_York|America/Indiana/Marengo",
			"America/New_York|America/Indiana/Petersburg",
			"America/New_York|America/Indiana/Vevay",
			"America/New_York|America/Indiana/Vincennes",
			"America/New_York|America/Indiana/Winamac",
			"America/New_York|America/Indianapolis",
			"America/New_York|America/Iqaluit",
			"America/New_York|America/Kentucky/Louisville",
			"America/New_York|America/Kentucky/Monticello",
			"America/New_York|America/Louisville",
			"America/New_York|America/Montreal",
			"America/New_York|America/Nassau",
			"America/New_York|America/Nipigon",
			"America/New_York|America/Pangnirtung",
			"America/New_York|America/Thunder_Bay",
			"America/New_York|America/Toronto",
			"America/New_York|Canada/Eastern",
			"America/New_York|EST5EDT",
			"America/New_York|US/East-Indiana",
			"America/New_York|US/Eastern",
			"America/New_York|US/Michigan",
			"America/Noronha|Atlantic/South_Georgia",
			"America/Noronha|Brazil/DeNoronha",
			"America/Noronha|Etc/GMT+2",
			"America/Panama|America/Atikokan",
			"America/Panama|America/Cayman",
			"America/Panama|America/Coral_Harbour",
			"America/Panama|America/Jamaica",
			"America/Panama|EST",
			"America/Panama|Jamaica",
			"America/Phoenix|America/Creston",
			"America/Phoenix|America/Dawson_Creek",
			"America/Phoenix|America/Hermosillo",
			"America/Phoenix|MST",
			"America/Phoenix|US/Arizona",
			"America/Santiago|Chile/Continental",
			"America/Santo_Domingo|America/Anguilla",
			"America/Santo_Domingo|America/Antigua",
			"America/Santo_Domingo|America/Aruba",
			"America/Santo_Domingo|America/Barbados",
			"America/Santo_Domingo|America/Blanc-Sablon",
			"America/Santo_Domingo|America/Curacao",
			"America/Santo_Domingo|America/Dominica",
			"America/Santo_Domingo|America/Grenada",
			"America/Santo_Domingo|America/Guadeloupe",
			"America/Santo_Domingo|America/Kralendijk",
			"America/Santo_Domingo|America/Lower_Princes",
			"America/Santo_Domingo|America/Marigot",
			"America/Santo_Domingo|America/Martinique",
			"America/Santo_Domingo|America/Montserrat",
			"America/Santo_Domingo|America/Port_of_Spain",
			"America/Santo_Domingo|America/Puerto_Rico",
			"America/Santo_Domingo|America/St_Barthelemy",
			"America/Santo_Domingo|America/St_Kitts",
			"America/Santo_Domingo|America/St_Lucia",
			"America/Santo_Domingo|America/St_Thomas",
			"America/Santo_Domingo|America/St_Vincent",
			"America/Santo_Domingo|America/Tortola",
			"America/Santo_Domingo|America/Virgin",
			"America/Sao_Paulo|Brazil/East",
			"America/St_Johns|Canada/Newfoundland",
			"Antarctica/Palmer|America/Punta_Arenas",
			"Asia/Baghdad|Antarctica/Syowa",
			"Asia/Baghdad|Asia/Aden",
			"Asia/Baghdad|Asia/Bahrain",
			"Asia/Baghdad|Asia/Kuwait",
			"Asia/Baghdad|Asia/Qatar",
			"Asia/Baghdad|Asia/Riyadh",
			"Asia/Baghdad|Etc/GMT-3",
			"Asia/Baghdad|Europe/Minsk",
			"Asia/Bangkok|Antarctica/Davis",
			"Asia/Bangkok|Asia/Ho_Chi_Minh",
			"Asia/Bangkok|Asia/Novokuznetsk",
			"Asia/Bangkok|Asia/Phnom_Penh",
			"Asia/Bangkok|Asia/Saigon",
			"Asia/Bangkok|Asia/Vientiane",
			"Asia/Bangkok|Etc/GMT-7",
			"Asia/Bangkok|Indian/Christmas",
			"Asia/Dhaka|Antarctica/Vostok",
			"Asia/Dhaka|Asia/Almaty",
			"Asia/Dhaka|Asia/Bishkek",
			"Asia/Dhaka|Asia/Dacca",
			"Asia/Dhaka|Asia/Kashgar",
			"Asia/Dhaka|Asia/Qostanay",
			"Asia/Dhaka|Asia/Thimbu",
			"Asia/Dhaka|Asia/Thimphu",
			"Asia/Dhaka|Asia/Urumqi",
			"Asia/Dhaka|Etc/GMT-6",
			"Asia/Dhaka|Indian/Chagos",
			"Asia/Dili|Etc/GMT-9",
			"Asia/Dili|Pacific/Palau",
			"Asia/Dubai|Asia/Muscat",
			"Asia/Dubai|Asia/Tbilisi",
			"Asia/Dubai|Asia/Yerevan",
			"Asia/Dubai|Etc/GMT-4",
			"Asia/Dubai|Europe/Samara",
			"Asia/Dubai|Indian/Mahe",
			"Asia/Dubai|Indian/Mauritius",
			"Asia/Dubai|Indian/Reunion",
			"Asia/Gaza|Asia/Hebron",
			"Asia/Hong_Kong|Hongkong",
			"Asia/Jakarta|Asia/Pontianak",
			"Asia/Jerusalem|Asia/Tel_Aviv",
			"Asia/Jerusalem|Israel",
			"Asia/Kamchatka|Asia/Anadyr",
			"Asia/Kamchatka|Etc/GMT-12",
			"Asia/Kamchatka|Kwajalein",
			"Asia/Kamchatka|Pacific/Funafuti",
			"Asia/Kamchatka|Pacific/Kwajalein",
			"Asia/Kamchatka|Pacific/Majuro",
			"Asia/Kamchatka|Pacific/Nauru",
			"Asia/Kamchatka|Pacific/Tarawa",
			"Asia/Kamchatka|Pacific/Wake",
			"Asia/Kamchatka|Pacific/Wallis",
			"Asia/Kathmandu|Asia/Katmandu",
			"Asia/Kolkata|Asia/Calcutta",
			"Asia/Kuala_Lumpur|Asia/Brunei",
			"Asia/Kuala_Lumpur|Asia/Kuching",
			"Asia/Kuala_Lumpur|Asia/Singapore",
			"Asia/Kuala_Lumpur|Etc/GMT-8",
			"Asia/Kuala_Lumpur|Singapore",
			"Asia/Makassar|Asia/Ujung_Pandang",
			"Asia/Rangoon|Asia/Yangon",
			"Asia/Rangoon|Indian/Cocos",
			"Asia/Seoul|ROK",
			"Asia/Shanghai|Asia/Chongqing",
			"Asia/Shanghai|Asia/Chungking",
			"Asia/Shanghai|Asia/Harbin",
			"Asia/Shanghai|Asia/Macao",
			"Asia/Shanghai|Asia/Macau",
			"Asia/Shanghai|Asia/Taipei",
			"Asia/Shanghai|PRC",
			"Asia/Shanghai|ROC",
			"Asia/Tashkent|Antarctica/Mawson",
			"Asia/Tashkent|Asia/Aqtau",
			"Asia/Tashkent|Asia/Aqtobe",
			"Asia/Tashkent|Asia/Ashgabat",
			"Asia/Tashkent|Asia/Ashkhabad",
			"Asia/Tashkent|Asia/Atyrau",
			"Asia/Tashkent|Asia/Dushanbe",
			"Asia/Tashkent|Asia/Oral",
			"Asia/Tashkent|Asia/Samarkand",
			"Asia/Tashkent|Etc/GMT-5",
			"Asia/Tashkent|Indian/Kerguelen",
			"Asia/Tashkent|Indian/Maldives",
			"Asia/Tehran|Iran",
			"Asia/Tokyo|Japan",
			"Asia/Ulaanbaatar|Asia/Choibalsan",
			"Asia/Ulaanbaatar|Asia/Ulan_Bator",
			"Asia/Vladivostok|Asia/Ust-Nera",
			"Asia/Yakutsk|Asia/Khandyga",
			"Atlantic/Azores|America/Scoresbysund",
			"Atlantic/Cape_Verde|Etc/GMT+1",
			"Australia/Adelaide|Australia/Broken_Hill",
			"Australia/Adelaide|Australia/South",
			"Australia/Adelaide|Australia/Yancowinna",
			"Australia/Brisbane|Australia/Lindeman",
			"Australia/Brisbane|Australia/Queensland",
			"Australia/Darwin|Australia/North",
			"Australia/Lord_Howe|Australia/LHI",
			"Australia/Perth|Australia/West",
			"Australia/Sydney|Australia/ACT",
			"Australia/Sydney|Australia/Canberra",
			"Australia/Sydney|Australia/Currie",
			"Australia/Sydney|Australia/Hobart",
			"Australia/Sydney|Australia/Melbourne",
			"Australia/Sydney|Australia/NSW",
			"Australia/Sydney|Australia/Tasmania",
			"Australia/Sydney|Australia/Victoria",
			"Etc/UTC|Etc/UCT",
			"Etc/UTC|Etc/Universal",
			"Etc/UTC|Etc/Zulu",
			"Etc/UTC|UCT",
			"Etc/UTC|UTC",
			"Etc/UTC|Universal",
			"Etc/UTC|Zulu",
			"Europe/Athens|Asia/Nicosia",
			"Europe/Athens|EET",
			"Europe/Athens|Europe/Bucharest",
			"Europe/Athens|Europe/Helsinki",
			"Europe/Athens|Europe/Kiev",
			"Europe/Athens|Europe/Mariehamn",
			"Europe/Athens|Europe/Nicosia",
			"Europe/Athens|Europe/Riga",
			"Europe/Athens|Europe/Sofia",
			"Europe/Athens|Europe/Tallinn",
			"Europe/Athens|Europe/Uzhgorod",
			"Europe/Athens|Europe/Vilnius",
			"Europe/Athens|Europe/Zaporozhye",
			"Europe/Chisinau|Europe/Tiraspol",
			"Europe/Dublin|Eire",
			"Europe/Istanbul|Asia/Istanbul",
			"Europe/Istanbul|Turkey",
			"Europe/Lisbon|Atlantic/Canary",
			"Europe/Lisbon|Atlantic/Faeroe",
			"Europe/Lisbon|Atlantic/Faroe",
			"Europe/Lisbon|Atlantic/Madeira",
			"Europe/Lisbon|Portugal",
			"Europe/Lisbon|WET",
			"Europe/London|Europe/Belfast",
			"Europe/London|Europe/Guernsey",
			"Europe/London|Europe/Isle_of_Man",
			"Europe/London|Europe/Jersey",
			"Europe/London|GB",
			"Europe/London|GB-Eire",
			"Europe/Moscow|W-SU",
			"Europe/Paris|Africa/Ceuta",
			"Europe/Paris|Arctic/Longyearbyen",
			"Europe/Paris|Atlantic/Jan_Mayen",
			"Europe/Paris|CET",
			"Europe/Paris|Europe/Amsterdam",
			"Europe/Paris|Europe/Andorra",
			"Europe/Paris|Europe/Belgrade",
			"Europe/Paris|Europe/Berlin",
			"Europe/Paris|Europe/Bratislava",
			"Europe/Paris|Europe/Brussels",
			"Europe/Paris|Europe/Budapest",
			"Europe/Paris|Europe/Busingen",
			"Europe/Paris|Europe/Copenhagen",
			"Europe/Paris|Europe/Gibraltar",
			"Europe/Paris|Europe/Ljubljana",
			"Europe/Paris|Europe/Luxembourg",
			"Europe/Paris|Europe/Madrid",
			"Europe/Paris|Europe/Malta",
			"Europe/Paris|Europe/Monaco",
			"Europe/Paris|Europe/Oslo",
			"Europe/Paris|Europe/Podgorica",
			"Europe/Paris|Europe/Prague",
			"Europe/Paris|Europe/Rome",
			"Europe/Paris|Europe/San_Marino",
			"Europe/Paris|Europe/Sarajevo",
			"Europe/Paris|Europe/Skopje",
			"Europe/Paris|Europe/Stockholm",
			"Europe/Paris|Europe/Tirane",
			"Europe/Paris|Europe/Vaduz",
			"Europe/Paris|Europe/Vatican",
			"Europe/Paris|Europe/Vienna",
			"Europe/Paris|Europe/Warsaw",
			"Europe/Paris|Europe/Zagreb",
			"Europe/Paris|Europe/Zurich",
			"Europe/Paris|Poland",
			"Europe/Ulyanovsk|Europe/Astrakhan",
			"Pacific/Auckland|Antarctica/McMurdo",
			"Pacific/Auckland|Antarctica/South_Pole",
			"Pacific/Auckland|NZ",
			"Pacific/Chatham|NZ-CHAT",
			"Pacific/Easter|Chile/EasterIsland",
			"Pacific/Fakaofo|Etc/GMT-13",
			"Pacific/Fakaofo|Pacific/Enderbury",
			"Pacific/Galapagos|Etc/GMT+6",
			"Pacific/Gambier|Etc/GMT+9",
			"Pacific/Guadalcanal|Antarctica/Macquarie",
			"Pacific/Guadalcanal|Etc/GMT-11",
			"Pacific/Guadalcanal|Pacific/Efate",
			"Pacific/Guadalcanal|Pacific/Kosrae",
			"Pacific/Guadalcanal|Pacific/Noumea",
			"Pacific/Guadalcanal|Pacific/Pohnpei",
			"Pacific/Guadalcanal|Pacific/Ponape",
			"Pacific/Guam|Pacific/Saipan",
			"Pacific/Honolulu|HST",
			"Pacific/Honolulu|Pacific/Johnston",
			"Pacific/Honolulu|US/Hawaii",
			"Pacific/Kiritimati|Etc/GMT-14",
			"Pacific/Niue|Etc/GMT+11",
			"Pacific/Pago_Pago|Pacific/Midway",
			"Pacific/Pago_Pago|Pacific/Samoa",
			"Pacific/Pago_Pago|US/Samoa",
			"Pacific/Pitcairn|Etc/GMT+8",
			"Pacific/Port_Moresby|Antarctica/DumontDUrville",
			"Pacific/Port_Moresby|Etc/GMT-10",
			"Pacific/Port_Moresby|Pacific/Chuuk",
			"Pacific/Port_Moresby|Pacific/Truk",
			"Pacific/Port_Moresby|Pacific/Yap",
			"Pacific/Tahiti|Etc/GMT+10",
			"Pacific/Tahiti|Pacific/Rarotonga"
		]
	});


	return moment;
}));
//! moment.js locale configuration

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


    var symbolMap = {
        '1': '۱',
        '2': '۲',
        '3': '۳',
        '4': '۴',
        '5': '۵',
        '6': '۶',
        '7': '۷',
        '8': '۸',
        '9': '۹',
        '0': '۰'
    }, numberMap = {
        '۱': '1',
        '۲': '2',
        '۳': '3',
        '۴': '4',
        '۵': '5',
        '۶': '6',
        '۷': '7',
        '۸': '8',
        '۹': '9',
        '۰': '0'
    };

    var fa = moment.defineLocale('fa', {
        months : 'ژانویه_فوریه_مارس_آوریل_مه_ژوئن_ژوئیه_اوت_سپتامبر_اکتبر_نوامبر_دسامبر'.split('_'),
        monthsShort : 'ژانویه_فوریه_مارس_آوریل_مه_ژوئن_ژوئیه_اوت_سپتامبر_اکتبر_نوامبر_دسامبر'.split('_'),
        weekdays : 'یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه'.split('_'),
        weekdaysShort : 'یک\u200cشنبه_دوشنبه_سه\u200cشنبه_چهارشنبه_پنج\u200cشنبه_جمعه_شنبه'.split('_'),
        weekdaysMin : 'ی_د_س_چ_پ_ج_ش'.split('_'),
        weekdaysParseExact : true,
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD/MM/YYYY',
            LL : 'D MMMM YYYY',
            LLL : 'D MMMM YYYY HH:mm',
            LLLL : 'dddd, D MMMM YYYY HH:mm'
        },
        meridiemParse: /قبل از ظهر|بعد از ظهر/,
        isPM: function (input) {
            return /بعد از ظهر/.test(input);
        },
        meridiem : function (hour, minute, isLower) {
            if (hour < 12) {
                return 'قبل از ظهر';
            } else {
                return 'بعد از ظهر';
            }
        },
        calendar : {
            sameDay : '[امروز ساعت] LT',
            nextDay : '[فردا ساعت] LT',
            nextWeek : 'dddd [ساعت] LT',
            lastDay : '[دیروز ساعت] LT',
            lastWeek : 'dddd [پیش] [ساعت] LT',
            sameElse : 'L'
        },
        relativeTime : {
            future : 'در %s',
            past : '%s پیش',
            s : 'چند ثانیه',
            ss : 'ثانیه d%',
            m : 'یک دقیقه',
            mm : '%d دقیقه',
            h : 'یک ساعت',
            hh : '%d ساعت',
            d : 'یک روز',
            dd : '%d روز',
            M : 'یک ماه',
            MM : '%d ماه',
            y : 'یک سال',
            yy : '%d سال'
        },
        preparse: function (string) {
            return string.replace(/[۰-۹]/g, function (match) {
                return numberMap[match];
            }).replace(/،/g, ',');
        },
        postformat: function (string) {
            return string.replace(/\d/g, function (match) {
                return symbolMap[match];
            }).replace(/,/g, '،');
        },
        dayOfMonthOrdinalParse: /\d{1,2}م/,
        ordinal : '%dم',
        week : {
            dow : 6, // Saturday is the first day of the week.
            doy : 12 // The week that contains Jan 12th is the first week of the year.
        }
    });

    return fa;

})));

// moment-timezone-localization for lang code: fa

;(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined'
       && typeof require === 'function' ? factory(require('../moment')) :
   typeof define === 'function' && define.amd ? define(['../moment'], factory) :
   factory(global.moment)
}(this, (function (moment) { 'use strict';


moment.tz.localizedNames = function() {
  return [{"value":"Africa/Abidjan","name":"آبیجان","id":"Africa/Abidjan"},{"value":"Africa/Accra","name":"اکرا","id":"Africa/Accra"},{"value":"Africa/Addis_Ababa","name":"آدیس آبابا","id":"Africa/Addis_Ababa"},{"value":"Africa/Algiers","name":"الجزیره","id":"Africa/Algiers"},{"value":"Africa/Asmera","name":"اسمره","id":"Africa/Asmera"},{"value":"Africa/Bamako","name":"باماکو","id":"Africa/Bamako"},{"value":"Africa/Bangui","name":"بانگی","id":"Africa/Bangui"},{"value":"Africa/Banjul","name":"بانجول","id":"Africa/Banjul"},{"value":"Africa/Bissau","name":"بیسائو","id":"Africa/Bissau"},{"value":"Africa/Blantyre","name":"بلانتیره","id":"Africa/Blantyre"},{"value":"Africa/Brazzaville","name":"برازویل","id":"Africa/Brazzaville"},{"value":"Africa/Bujumbura","name":"بوجومبورا","id":"Africa/Bujumbura"},{"value":"Africa/Cairo","name":"قاهره","id":"Africa/Cairo"},{"value":"Africa/Casablanca","name":"کازابلانکا","id":"Africa/Casablanca"},{"value":"Africa/Ceuta","name":"سبته","id":"Africa/Ceuta"},{"value":"Africa/Conakry","name":"کوناکری","id":"Africa/Conakry"},{"value":"Africa/Dakar","name":"داکار","id":"Africa/Dakar"},{"value":"Africa/Dar_es_Salaam","name":"دارالسلام","id":"Africa/Dar_es_Salaam"},{"value":"Africa/Djibouti","name":"جیبوتی","id":"Africa/Djibouti"},{"value":"Africa/Douala","name":"دوآلا","id":"Africa/Douala"},{"value":"Africa/El_Aaiun","name":"العیون","id":"Africa/El_Aaiun"},{"value":"Africa/Freetown","name":"فری‌تاون","id":"Africa/Freetown"},{"value":"Africa/Gaborone","name":"گابورون","id":"Africa/Gaborone"},{"value":"Africa/Harare","name":"هراره","id":"Africa/Harare"},{"value":"Africa/Johannesburg","name":"ژوهانسبورگ","id":"Africa/Johannesburg"},{"value":"Africa/Juba","name":"جوبا","id":"Africa/Juba"},{"value":"Africa/Kampala","name":"کامپالا","id":"Africa/Kampala"},{"value":"Africa/Khartoum","name":"خارطوم","id":"Africa/Khartoum"},{"value":"Africa/Kigali","name":"کیگالی","id":"Africa/Kigali"},{"value":"Africa/Kinshasa","name":"کینشاسا","id":"Africa/Kinshasa"},{"value":"Africa/Lagos","name":"لاگوس","id":"Africa/Lagos"},{"value":"Africa/Libreville","name":"لیبرویل","id":"Africa/Libreville"},{"value":"Africa/Lome","name":"لومه","id":"Africa/Lome"},{"value":"Africa/Luanda","name":"لواندا","id":"Africa/Luanda"},{"value":"Africa/Lubumbashi","name":"لوبومباشی","id":"Africa/Lubumbashi"},{"value":"Africa/Lusaka","name":"لوزاکا","id":"Africa/Lusaka"},{"value":"Africa/Malabo","name":"مالابو","id":"Africa/Malabo"},{"value":"Africa/Maputo","name":"ماپوتو","id":"Africa/Maputo"},{"value":"Africa/Maseru","name":"ماسرو","id":"Africa/Maseru"},{"value":"Africa/Mbabane","name":"مبابانه","id":"Africa/Mbabane"},{"value":"Africa/Mogadishu","name":"موگادیشو","id":"Africa/Mogadishu"},{"value":"Africa/Monrovia","name":"مونروویا","id":"Africa/Monrovia"},{"value":"Africa/Nairobi","name":"نایروبی","id":"Africa/Nairobi"},{"value":"Africa/Ndjamena","name":"انجامنا","id":"Africa/Ndjamena"},{"value":"Africa/Niamey","name":"نیامی","id":"Africa/Niamey"},{"value":"Africa/Nouakchott","name":"نوآکشوت","id":"Africa/Nouakchott"},{"value":"Africa/Ouagadougou","name":"اوآگادوگو","id":"Africa/Ouagadougou"},{"value":"Africa/Porto-Novo","name":"پورتو نووو","id":"Africa/Porto-Novo"},{"value":"Africa/Sao_Tome","name":"سائوتومه","id":"Africa/Sao_Tome"},{"value":"Africa/Tripoli","name":"طرابلس","id":"Africa/Tripoli"},{"value":"Africa/Tunis","name":"شهر تونس","id":"Africa/Tunis"},{"value":"Africa/Windhoek","name":"ویندهوک","id":"Africa/Windhoek"},{"value":"America/Adak","name":"ایدک","id":"America/Adak"},{"value":"America/Anchorage","name":"انکوریج","id":"America/Anchorage"},{"value":"America/Anguilla","name":"آنگوئیلا","id":"America/Anguilla"},{"value":"America/Antigua","name":"آنتیگوا","id":"America/Antigua"},{"value":"America/Araguaina","name":"آراگواینا","id":"America/Araguaina"},{"value":"America/Argentina/La_Rioja","name":"لاریوخا","id":"America/Argentina/La_Rioja"},{"value":"America/Argentina/Rio_Gallegos","name":"ریوگالگوس","id":"America/Argentina/Rio_Gallegos"},{"value":"America/Argentina/Salta","name":"سالتا","id":"America/Argentina/Salta"},{"value":"America/Argentina/San_Juan","name":"سن‌خوان","id":"America/Argentina/San_Juan"},{"value":"America/Argentina/San_Luis","name":"سن‌لوئیس","id":"America/Argentina/San_Luis"},{"value":"America/Argentina/Tucuman","name":"توکومن","id":"America/Argentina/Tucuman"},{"value":"America/Argentina/Ushuaia","name":"اوشوایا","id":"America/Argentina/Ushuaia"},{"value":"America/Aruba","name":"اروبا","id":"America/Aruba"},{"value":"America/Asuncion","name":"آسونسیون","id":"America/Asuncion"},{"value":"America/Bahia","name":"بایا","id":"America/Bahia"},{"value":"America/Bahia_Banderas","name":"باهیا باندراس","id":"America/Bahia_Banderas"},{"value":"America/Barbados","name":"باربادوس","id":"America/Barbados"},{"value":"America/Belem","name":"بلم","id":"America/Belem"},{"value":"America/Belize","name":"بلیز","id":"America/Belize"},{"value":"America/Blanc-Sablon","name":"بلان‐سابلون","id":"America/Blanc-Sablon"},{"value":"America/Boa_Vista","name":"بوئاویستا","id":"America/Boa_Vista"},{"value":"America/Bogota","name":"بوگوتا","id":"America/Bogota"},{"value":"America/Boise","name":"بویسی","id":"America/Boise"},{"value":"America/Buenos_Aires","name":"بوئنوس‌آیرس","id":"America/Buenos_Aires"},{"value":"America/Cambridge_Bay","name":"کمبریج‌بی","id":"America/Cambridge_Bay"},{"value":"America/Campo_Grande","name":"کمپو گرانده","id":"America/Campo_Grande"},{"value":"America/Cancun","name":"کانکون","id":"America/Cancun"},{"value":"America/Caracas","name":"کاراکاس","id":"America/Caracas"},{"value":"America/Catamarca","name":"کاتامارکا","id":"America/Catamarca"},{"value":"America/Cayenne","name":"کاین","id":"America/Cayenne"},{"value":"America/Cayman","name":"کیمن","id":"America/Cayman"},{"value":"America/Chicago","name":"شیکاگو","id":"America/Chicago"},{"value":"America/Chihuahua","name":"چیواوا","id":"America/Chihuahua"},{"value":"America/Coral_Harbour","name":"اتکوکان","id":"America/Coral_Harbour"},{"value":"America/Cordoba","name":"کوردووا","id":"America/Cordoba"},{"value":"America/Costa_Rica","name":"کاستاریکا","id":"America/Costa_Rica"},{"value":"America/Creston","name":"کرستون","id":"America/Creston"},{"value":"America/Cuiaba","name":"کویاوا","id":"America/Cuiaba"},{"value":"America/Curacao","name":"کوراسائو","id":"America/Curacao"},{"value":"America/Danmarkshavn","name":"دانمارکس‌هاون","id":"America/Danmarkshavn"},{"value":"America/Dawson","name":"داوسن","id":"America/Dawson"},{"value":"America/Dawson_Creek","name":"داوسن کریک","id":"America/Dawson_Creek"},{"value":"America/Denver","name":"دنور","id":"America/Denver"},{"value":"America/Detroit","name":"دیترویت","id":"America/Detroit"},{"value":"America/Dominica","name":"دومینیکا","id":"America/Dominica"},{"value":"America/Edmonton","name":"ادمونتون","id":"America/Edmonton"},{"value":"America/Eirunepe","name":"ایرونپه","id":"America/Eirunepe"},{"value":"America/El_Salvador","name":"السالوادور","id":"America/El_Salvador"},{"value":"America/Fort_Nelson","name":"فورت نلسون","id":"America/Fort_Nelson"},{"value":"America/Fortaleza","name":"فورتالزا","id":"America/Fortaleza"},{"value":"America/Glace_Bay","name":"گلیس‌بی","id":"America/Glace_Bay"},{"value":"America/Godthab","name":"نووک","id":"America/Godthab"},{"value":"America/Goose_Bay","name":"گوس‌بی","id":"America/Goose_Bay"},{"value":"America/Grand_Turk","name":"گراند تورک","id":"America/Grand_Turk"},{"value":"America/Grenada","name":"گرنادا","id":"America/Grenada"},{"value":"America/Guadeloupe","name":"گوادلوپ","id":"America/Guadeloupe"},{"value":"America/Guatemala","name":"گواتمالا","id":"America/Guatemala"},{"value":"America/Guayaquil","name":"گوایاکیل","id":"America/Guayaquil"},{"value":"America/Guyana","name":"گویان","id":"America/Guyana"},{"value":"America/Halifax","name":"هلیفکس","id":"America/Halifax"},{"value":"America/Havana","name":"هاوانا","id":"America/Havana"},{"value":"America/Hermosillo","name":"ارموسیو","id":"America/Hermosillo"},{"value":"America/Indiana/Knox","name":"ناکس، ایندیانا","id":"America/Indiana/Knox"},{"value":"America/Indiana/Marengo","name":"مارنگو، ایندیانا","id":"America/Indiana/Marengo"},{"value":"America/Indiana/Petersburg","name":"پیترزبرگ، ایندیانا","id":"America/Indiana/Petersburg"},{"value":"America/Indiana/Tell_City","name":"تل‌سیتی، ایندیانا","id":"America/Indiana/Tell_City"},{"value":"America/Indiana/Vevay","name":"ویوی، ایندیانا","id":"America/Indiana/Vevay"},{"value":"America/Indiana/Vincennes","name":"وینسنس، اندیانا","id":"America/Indiana/Vincennes"},{"value":"America/Indiana/Winamac","name":"ویناماک، ایندیانا","id":"America/Indiana/Winamac"},{"value":"America/Indianapolis","name":"ایندیاناپولیس","id":"America/Indianapolis"},{"value":"America/Inuvik","name":"اینوویک","id":"America/Inuvik"},{"value":"America/Iqaluit","name":"ایکلوئت","id":"America/Iqaluit"},{"value":"America/Jamaica","name":"جامائیکا","id":"America/Jamaica"},{"value":"America/Jujuy","name":"خوخوی","id":"America/Jujuy"},{"value":"America/Juneau","name":"جونو","id":"America/Juneau"},{"value":"America/Kentucky/Monticello","name":"مانتیسلو، کنتاکی","id":"America/Kentucky/Monticello"},{"value":"America/Kralendijk","name":"کرالندیک","id":"America/Kralendijk"},{"value":"America/La_Paz","name":"لاپاز","id":"America/La_Paz"},{"value":"America/Lima","name":"لیما","id":"America/Lima"},{"value":"America/Los_Angeles","name":"لوس‌آنجلس","id":"America/Los_Angeles"},{"value":"America/Louisville","name":"لوئیزویل","id":"America/Louisville"},{"value":"America/Lower_Princes","name":"بخش شاهزاده‌‌نشین پایین","id":"America/Lower_Princes"},{"value":"America/Maceio","name":"ماسیو","id":"America/Maceio"},{"value":"America/Managua","name":"ماناگوا","id":"America/Managua"},{"value":"America/Manaus","name":"ماناوس","id":"America/Manaus"},{"value":"America/Marigot","name":"ماریگات","id":"America/Marigot"},{"value":"America/Martinique","name":"مارتینیک","id":"America/Martinique"},{"value":"America/Matamoros","name":"ماتاموروس","id":"America/Matamoros"},{"value":"America/Mazatlan","name":"ماساتلان","id":"America/Mazatlan"},{"value":"America/Mendoza","name":"مندوسا","id":"America/Mendoza"},{"value":"America/Menominee","name":"منامینی","id":"America/Menominee"},{"value":"America/Merida","name":"مریدا","id":"America/Merida"},{"value":"America/Metlakatla","name":"متالاکاتلا","id":"America/Metlakatla"},{"value":"America/Mexico_City","name":"مکزیکوسیتی","id":"America/Mexico_City"},{"value":"America/Miquelon","name":"میکلون","id":"America/Miquelon"},{"value":"America/Moncton","name":"مانکتون","id":"America/Moncton"},{"value":"America/Monterrey","name":"مونتری","id":"America/Monterrey"},{"value":"America/Montevideo","name":"مونته‌ویدئو","id":"America/Montevideo"},{"value":"America/Montserrat","name":"مونتسرات","id":"America/Montserrat"},{"value":"America/Nassau","name":"ناسائو","id":"America/Nassau"},{"value":"America/New_York","name":"نیویورک","id":"America/New_York"},{"value":"America/Nipigon","name":"نیپیگان","id":"America/Nipigon"},{"value":"America/Nome","name":"نوم","id":"America/Nome"},{"value":"America/Noronha","name":"نورونیا","id":"America/Noronha"},{"value":"America/North_Dakota/Beulah","name":"بیولا، داکوتای شمالی","id":"America/North_Dakota/Beulah"},{"value":"America/North_Dakota/Center","name":"سنتر، داکوتای شمالی","id":"America/North_Dakota/Center"},{"value":"America/North_Dakota/New_Salem","name":"نیوسالم، داکوتای شمالی","id":"America/North_Dakota/New_Salem"},{"value":"America/Ojinaga","name":"اخیناگا","id":"America/Ojinaga"},{"value":"America/Panama","name":"پاناما","id":"America/Panama"},{"value":"America/Pangnirtung","name":"پانگنیرتونگ","id":"America/Pangnirtung"},{"value":"America/Paramaribo","name":"پاراماریبو","id":"America/Paramaribo"},{"value":"America/Phoenix","name":"فینکس","id":"America/Phoenix"},{"value":"America/Port-au-Prince","name":"پورتوپرنس","id":"America/Port-au-Prince"},{"value":"America/Port_of_Spain","name":"پورت‌آواسپین","id":"America/Port_of_Spain"},{"value":"America/Porto_Velho","name":"پورتوولیو","id":"America/Porto_Velho"},{"value":"America/Puerto_Rico","name":"پورتوریکو","id":"America/Puerto_Rico"},{"value":"America/Punta_Arenas","name":"پونتا آرناس","id":"America/Punta_Arenas"},{"value":"America/Rainy_River","name":"رینی‌ریور","id":"America/Rainy_River"},{"value":"America/Rankin_Inlet","name":"خلیجک رنکین","id":"America/Rankin_Inlet"},{"value":"America/Recife","name":"ریسیفی","id":"America/Recife"},{"value":"America/Regina","name":"رجاینا","id":"America/Regina"},{"value":"America/Resolute","name":"رزولوت","id":"America/Resolute"},{"value":"America/Rio_Branco","name":"ریوبرانکو","id":"America/Rio_Branco"},{"value":"America/Santa_Isabel","name":"سانتا ایزابل","id":"America/Santa_Isabel"},{"value":"America/Santarem","name":"سنتارم","id":"America/Santarem"},{"value":"America/Santiago","name":"سانتیاگو","id":"America/Santiago"},{"value":"America/Santo_Domingo","name":"سانتو دومینگو","id":"America/Santo_Domingo"},{"value":"America/Sao_Paulo","name":"سائوپائولو","id":"America/Sao_Paulo"},{"value":"America/Scoresbysund","name":"اسکورسبیسوند","id":"America/Scoresbysund"},{"value":"America/Sitka","name":"سیتکا","id":"America/Sitka"},{"value":"America/St_Barthelemy","name":"سنت بارتلمی","id":"America/St_Barthelemy"},{"value":"America/St_Johns","name":"سنت جان","id":"America/St_Johns"},{"value":"America/St_Kitts","name":"سنت کیتس","id":"America/St_Kitts"},{"value":"America/St_Lucia","name":"سنت لوسیا","id":"America/St_Lucia"},{"value":"America/St_Thomas","name":"سنت توماس","id":"America/St_Thomas"},{"value":"America/St_Vincent","name":"سنت وینسنت","id":"America/St_Vincent"},{"value":"America/Swift_Current","name":"سویفت‌کارنت","id":"America/Swift_Current"},{"value":"America/Tegucigalpa","name":"تگوسیگالپا","id":"America/Tegucigalpa"},{"value":"America/Thule","name":"تول","id":"America/Thule"},{"value":"America/Thunder_Bay","name":"تاندربی","id":"America/Thunder_Bay"},{"value":"America/Tijuana","name":"تیخوانا","id":"America/Tijuana"},{"value":"America/Toronto","name":"تورنتو","id":"America/Toronto"},{"value":"America/Tortola","name":"تورتولا","id":"America/Tortola"},{"value":"America/Vancouver","name":"ونکوور","id":"America/Vancouver"},{"value":"America/Whitehorse","name":"وایت‌هورس","id":"America/Whitehorse"},{"value":"America/Winnipeg","name":"وینیپگ","id":"America/Winnipeg"},{"value":"America/Yakutat","name":"یاکوتات","id":"America/Yakutat"},{"value":"America/Yellowknife","name":"یلونایف","id":"America/Yellowknife"},{"value":"Antarctica/Casey","name":"کیسی","id":"Antarctica/Casey"},{"value":"Antarctica/Davis","name":"دیویس","id":"Antarctica/Davis"},{"value":"Antarctica/DumontDUrville","name":"دومون دورویل","id":"Antarctica/DumontDUrville"},{"value":"Antarctica/Macquarie","name":"مکواری","id":"Antarctica/Macquarie"},{"value":"Antarctica/Mawson","name":"ماوسون","id":"Antarctica/Mawson"},{"value":"Antarctica/McMurdo","name":"مک‌موردو","id":"Antarctica/McMurdo"},{"value":"Antarctica/Palmer","name":"پالمر","id":"Antarctica/Palmer"},{"value":"Antarctica/Rothera","name":"روترا","id":"Antarctica/Rothera"},{"value":"Antarctica/Syowa","name":"شووا","id":"Antarctica/Syowa"},{"value":"Antarctica/Troll","name":"ترول","id":"Antarctica/Troll"},{"value":"Antarctica/Vostok","name":"وستوک","id":"Antarctica/Vostok"},{"value":"Arctic/Longyearbyen","name":"لانگ‌یربین","id":"Arctic/Longyearbyen"},{"value":"Asia/Aden","name":"عدن","id":"Asia/Aden"},{"value":"Asia/Almaty","name":"آلماتی","id":"Asia/Almaty"},{"value":"Asia/Amman","name":"عمّان","id":"Asia/Amman"},{"value":"Asia/Anadyr","name":"آنادیر","id":"Asia/Anadyr"},{"value":"Asia/Aqtau","name":"آقتاو","id":"Asia/Aqtau"},{"value":"Asia/Aqtobe","name":"آقتوبه","id":"Asia/Aqtobe"},{"value":"Asia/Ashgabat","name":"عشق‌آباد","id":"Asia/Ashgabat"},{"value":"Asia/Atyrau","name":"آتیراو","id":"Asia/Atyrau"},{"value":"Asia/Baghdad","name":"بغداد","id":"Asia/Baghdad"},{"value":"Asia/Bahrain","name":"بحرین","id":"Asia/Bahrain"},{"value":"Asia/Baku","name":"باکو","id":"Asia/Baku"},{"value":"Asia/Bangkok","name":"بانکوک","id":"Asia/Bangkok"},{"value":"Asia/Barnaul","name":"بارنائول","id":"Asia/Barnaul"},{"value":"Asia/Beirut","name":"بیروت","id":"Asia/Beirut"},{"value":"Asia/Bishkek","name":"بیشکک","id":"Asia/Bishkek"},{"value":"Asia/Brunei","name":"برونئی","id":"Asia/Brunei"},{"value":"Asia/Calcutta","name":"کلکته","id":"Asia/Calcutta"},{"value":"Asia/Chita","name":"چیتا","id":"Asia/Chita"},{"value":"Asia/Choibalsan","name":"چویبالسان","id":"Asia/Choibalsan"},{"value":"Asia/Colombo","name":"کلمبو","id":"Asia/Colombo"},{"value":"Asia/Damascus","name":"دمشق","id":"Asia/Damascus"},{"value":"Asia/Dhaka","name":"داکا","id":"Asia/Dhaka"},{"value":"Asia/Dili","name":"دیلی","id":"Asia/Dili"},{"value":"Asia/Dubai","name":"دبی","id":"Asia/Dubai"},{"value":"Asia/Dushanbe","name":"دوشنبه","id":"Asia/Dushanbe"},{"value":"Asia/Famagusta","name":"فاماگوستا","id":"Asia/Famagusta"},{"value":"Asia/Gaza","name":"غزه","id":"Asia/Gaza"},{"value":"Asia/Hebron","name":"الخلیل","id":"Asia/Hebron"},{"value":"Asia/Hong_Kong","name":"هنگ‌کنگ","id":"Asia/Hong_Kong"},{"value":"Asia/Hovd","name":"خوود","id":"Asia/Hovd"},{"value":"Asia/Irkutsk","name":"ایرکوتسک","id":"Asia/Irkutsk"},{"value":"Asia/Jakarta","name":"جاکارتا","id":"Asia/Jakarta"},{"value":"Asia/Jayapura","name":"جایاپورا","id":"Asia/Jayapura"},{"value":"Asia/Jerusalem","name":"اورشلیم","id":"Asia/Jerusalem"},{"value":"Asia/Kabul","name":"کابل","id":"Asia/Kabul"},{"value":"Asia/Kamchatka","name":"کامچاتکا","id":"Asia/Kamchatka"},{"value":"Asia/Karachi","name":"کراچی","id":"Asia/Karachi"},{"value":"Asia/Katmandu","name":"کاتماندو","id":"Asia/Katmandu"},{"value":"Asia/Khandyga","name":"خاندیگا","id":"Asia/Khandyga"},{"value":"Asia/Krasnoyarsk","name":"کراسنویارسک","id":"Asia/Krasnoyarsk"},{"value":"Asia/Kuala_Lumpur","name":"کوالالامپور","id":"Asia/Kuala_Lumpur"},{"value":"Asia/Kuching","name":"کوچینگ","id":"Asia/Kuching"},{"value":"Asia/Kuwait","name":"کویت","id":"Asia/Kuwait"},{"value":"Asia/Macau","name":"ماکائو","id":"Asia/Macau"},{"value":"Asia/Magadan","name":"ماگادان","id":"Asia/Magadan"},{"value":"Asia/Makassar","name":"ماکاسار","id":"Asia/Makassar"},{"value":"Asia/Manila","name":"مانیل","id":"Asia/Manila"},{"value":"Asia/Muscat","name":"مسقط","id":"Asia/Muscat"},{"value":"Asia/Nicosia","name":"نیکوزیا","id":"Asia/Nicosia"},{"value":"Asia/Novokuznetsk","name":"نوووکوزنتسک","id":"Asia/Novokuznetsk"},{"value":"Asia/Novosibirsk","name":"نووسیبیریسک","id":"Asia/Novosibirsk"},{"value":"Asia/Omsk","name":"اومسک","id":"Asia/Omsk"},{"value":"Asia/Oral","name":"اورال","id":"Asia/Oral"},{"value":"Asia/Phnom_Penh","name":"پنوم‌پن","id":"Asia/Phnom_Penh"},{"value":"Asia/Pontianak","name":"پونتیاناک","id":"Asia/Pontianak"},{"value":"Asia/Pyongyang","name":"پیونگ‌یانگ","id":"Asia/Pyongyang"},{"value":"Asia/Qatar","name":"قطر","id":"Asia/Qatar"},{"value":"Asia/Qyzylorda","name":"قیزیل‌اوردا","id":"Asia/Qyzylorda"},{"value":"Asia/Rangoon","name":"یانگون","id":"Asia/Rangoon"},{"value":"Asia/Riyadh","name":"ریاض","id":"Asia/Riyadh"},{"value":"Asia/Saigon","name":"هوشی‌مین‌سیتی","id":"Asia/Saigon"},{"value":"Asia/Sakhalin","name":"ساخالین","id":"Asia/Sakhalin"},{"value":"Asia/Samarkand","name":"سمرقند","id":"Asia/Samarkand"},{"value":"Asia/Seoul","name":"سئول","id":"Asia/Seoul"},{"value":"Asia/Shanghai","name":"شانگهای","id":"Asia/Shanghai"},{"value":"Asia/Singapore","name":"سنگاپور","id":"Asia/Singapore"},{"value":"Asia/Srednekolymsk","name":"اسردنکولیمسک","id":"Asia/Srednekolymsk"},{"value":"Asia/Taipei","name":"تایپه","id":"Asia/Taipei"},{"value":"Asia/Tashkent","name":"تاشکند","id":"Asia/Tashkent"},{"value":"Asia/Tbilisi","name":"تفلیس","id":"Asia/Tbilisi"},{"value":"Asia/Tehran","name":"تهران","id":"Asia/Tehran"},{"value":"Asia/Thimphu","name":"تیمفو","id":"Asia/Thimphu"},{"value":"Asia/Tokyo","name":"توکیو","id":"Asia/Tokyo"},{"value":"Asia/Tomsk","name":"تومسک","id":"Asia/Tomsk"},{"value":"Asia/Ulaanbaatar","name":"اولان‌باتور","id":"Asia/Ulaanbaatar"},{"value":"Asia/Urumqi","name":"ارومچی","id":"Asia/Urumqi"},{"value":"Asia/Ust-Nera","name":"اوست نرا","id":"Asia/Ust-Nera"},{"value":"Asia/Vientiane","name":"وینتیان","id":"Asia/Vientiane"},{"value":"Asia/Vladivostok","name":"ولادی‌وستوک","id":"Asia/Vladivostok"},{"value":"Asia/Yakutsk","name":"یاکوتسک","id":"Asia/Yakutsk"},{"value":"Asia/Yekaterinburg","name":"یکاترینبرگ","id":"Asia/Yekaterinburg"},{"value":"Asia/Yerevan","name":"ایروان","id":"Asia/Yerevan"},{"value":"Atlantic/Azores","name":"آزور","id":"Atlantic/Azores"},{"value":"Atlantic/Bermuda","name":"برمودا","id":"Atlantic/Bermuda"},{"value":"Atlantic/Canary","name":"قناری","id":"Atlantic/Canary"},{"value":"Atlantic/Cape_Verde","name":"کیپ‌ورد","id":"Atlantic/Cape_Verde"},{"value":"Atlantic/Faeroe","name":"فارو","id":"Atlantic/Faeroe"},{"value":"Atlantic/Madeira","name":"مادیرا","id":"Atlantic/Madeira"},{"value":"Atlantic/Reykjavik","name":"ریکیاویک","id":"Atlantic/Reykjavik"},{"value":"Atlantic/South_Georgia","name":"جورجیای جنوبی","id":"Atlantic/South_Georgia"},{"value":"Atlantic/St_Helena","name":"سنت هلنا","id":"Atlantic/St_Helena"},{"value":"Atlantic/Stanley","name":"استانلی","id":"Atlantic/Stanley"},{"value":"Australia/Adelaide","name":"آدلاید","id":"Australia/Adelaide"},{"value":"Australia/Brisbane","name":"بریسبین","id":"Australia/Brisbane"},{"value":"Australia/Broken_Hill","name":"بروکن‌هیل","id":"Australia/Broken_Hill"},{"value":"Australia/Currie","name":"کوری","id":"Australia/Currie"},{"value":"Australia/Darwin","name":"داروین","id":"Australia/Darwin"},{"value":"Australia/Eucla","name":"اوکلا","id":"Australia/Eucla"},{"value":"Australia/Hobart","name":"هوبارت","id":"Australia/Hobart"},{"value":"Australia/Lindeman","name":"لیندمن","id":"Australia/Lindeman"},{"value":"Australia/Lord_Howe","name":"لردهاو","id":"Australia/Lord_Howe"},{"value":"Australia/Melbourne","name":"ملبورن","id":"Australia/Melbourne"},{"value":"Australia/Perth","name":"پرت","id":"Australia/Perth"},{"value":"Australia/Sydney","name":"سیدنی","id":"Australia/Sydney"},{"value":"Etc/UTC","name":"زمان هماهنگ جهانی","id":"Etc/UTC"},{"value":"Europe/Amsterdam","name":"آمستردام","id":"Europe/Amsterdam"},{"value":"Europe/Andorra","name":"آندورا","id":"Europe/Andorra"},{"value":"Europe/Astrakhan","name":"آستراخان","id":"Europe/Astrakhan"},{"value":"Europe/Athens","name":"آتن","id":"Europe/Athens"},{"value":"Europe/Belgrade","name":"بلگراد","id":"Europe/Belgrade"},{"value":"Europe/Berlin","name":"برلین","id":"Europe/Berlin"},{"value":"Europe/Bratislava","name":"براتیسلاوا","id":"Europe/Bratislava"},{"value":"Europe/Brussels","name":"بروکسل","id":"Europe/Brussels"},{"value":"Europe/Bucharest","name":"بخارست","id":"Europe/Bucharest"},{"value":"Europe/Budapest","name":"بوداپست","id":"Europe/Budapest"},{"value":"Europe/Busingen","name":"بازنگن","id":"Europe/Busingen"},{"value":"Europe/Chisinau","name":"کیشیناو","id":"Europe/Chisinau"},{"value":"Europe/Copenhagen","name":"کپنهاگ","id":"Europe/Copenhagen"},{"value":"Europe/Dublin","name":"وقت عادی ایرلنددوبلین","id":"Europe/Dublin"},{"value":"Europe/Gibraltar","name":"جبل‌الطارق","id":"Europe/Gibraltar"},{"value":"Europe/Guernsey","name":"گرنزی","id":"Europe/Guernsey"},{"value":"Europe/Helsinki","name":"هلسینکی","id":"Europe/Helsinki"},{"value":"Europe/Isle_of_Man","name":"جزیرهٔ من","id":"Europe/Isle_of_Man"},{"value":"Europe/Istanbul","name":"استانبول","id":"Europe/Istanbul"},{"value":"Europe/Jersey","name":"جرزی","id":"Europe/Jersey"},{"value":"Europe/Kaliningrad","name":"کالینینگراد","id":"Europe/Kaliningrad"},{"value":"Europe/Kiev","name":"کیف","id":"Europe/Kiev"},{"value":"Europe/Kirov","name":"کیروف","id":"Europe/Kirov"},{"value":"Europe/Lisbon","name":"لیسبون","id":"Europe/Lisbon"},{"value":"Europe/Ljubljana","name":"لیوبلیانا","id":"Europe/Ljubljana"},{"value":"Europe/London","name":"وقت تابستانی بریتانیالندن","id":"Europe/London"},{"value":"Europe/Luxembourg","name":"لوکزامبورگ","id":"Europe/Luxembourg"},{"value":"Europe/Madrid","name":"مادرید","id":"Europe/Madrid"},{"value":"Europe/Malta","name":"مالت","id":"Europe/Malta"},{"value":"Europe/Mariehamn","name":"ماریه‌هامن","id":"Europe/Mariehamn"},{"value":"Europe/Minsk","name":"مینسک","id":"Europe/Minsk"},{"value":"Europe/Monaco","name":"موناکو","id":"Europe/Monaco"},{"value":"Europe/Moscow","name":"مسکو","id":"Europe/Moscow"},{"value":"Europe/Oslo","name":"اسلو","id":"Europe/Oslo"},{"value":"Europe/Paris","name":"پاریس","id":"Europe/Paris"},{"value":"Europe/Podgorica","name":"پادگاریتسا","id":"Europe/Podgorica"},{"value":"Europe/Prague","name":"پراگ","id":"Europe/Prague"},{"value":"Europe/Riga","name":"ریگا","id":"Europe/Riga"},{"value":"Europe/Rome","name":"رم","id":"Europe/Rome"},{"value":"Europe/Samara","name":"سامارا","id":"Europe/Samara"},{"value":"Europe/San_Marino","name":"سان‌مارینو","id":"Europe/San_Marino"},{"value":"Europe/Sarajevo","name":"سارایوو","id":"Europe/Sarajevo"},{"value":"Europe/Saratov","name":"ساراتوف","id":"Europe/Saratov"},{"value":"Europe/Simferopol","name":"سیمفروپل","id":"Europe/Simferopol"},{"value":"Europe/Skopje","name":"اسکوپیه","id":"Europe/Skopje"},{"value":"Europe/Sofia","name":"صوفیه","id":"Europe/Sofia"},{"value":"Europe/Stockholm","name":"استکهلم","id":"Europe/Stockholm"},{"value":"Europe/Tallinn","name":"تالین","id":"Europe/Tallinn"},{"value":"Europe/Tirane","name":"تیرانا","id":"Europe/Tirane"},{"value":"Europe/Ulyanovsk","name":"اولیانوفسک","id":"Europe/Ulyanovsk"},{"value":"Europe/Uzhgorod","name":"اوژگورود","id":"Europe/Uzhgorod"},{"value":"Europe/Vaduz","name":"فادوتس","id":"Europe/Vaduz"},{"value":"Europe/Vatican","name":"واتیکان","id":"Europe/Vatican"},{"value":"Europe/Vienna","name":"وین","id":"Europe/Vienna"},{"value":"Europe/Vilnius","name":"ویلنیوس","id":"Europe/Vilnius"},{"value":"Europe/Volgograd","name":"ولگاگراد","id":"Europe/Volgograd"},{"value":"Europe/Warsaw","name":"ورشو","id":"Europe/Warsaw"},{"value":"Europe/Zagreb","name":"زاگرب","id":"Europe/Zagreb"},{"value":"Europe/Zaporozhye","name":"زاپوروژیا","id":"Europe/Zaporozhye"},{"value":"Europe/Zurich","name":"زوریخ","id":"Europe/Zurich"},{"value":"Indian/Antananarivo","name":"آنتاناناریوو","id":"Indian/Antananarivo"},{"value":"Indian/Chagos","name":"شاگوس","id":"Indian/Chagos"},{"value":"Indian/Christmas","name":"کریسمس","id":"Indian/Christmas"},{"value":"Indian/Cocos","name":"کوکوس","id":"Indian/Cocos"},{"value":"Indian/Comoro","name":"کومورو","id":"Indian/Comoro"},{"value":"Indian/Kerguelen","name":"کرگولن","id":"Indian/Kerguelen"},{"value":"Indian/Mahe","name":"ماهه","id":"Indian/Mahe"},{"value":"Indian/Maldives","name":"مالدیو","id":"Indian/Maldives"},{"value":"Indian/Mauritius","name":"موریس","id":"Indian/Mauritius"},{"value":"Indian/Mayotte","name":"مایوت","id":"Indian/Mayotte"},{"value":"Indian/Reunion","name":"رئونیون","id":"Indian/Reunion"},{"value":"Pacific/Apia","name":"آپیا","id":"Pacific/Apia"},{"value":"Pacific/Auckland","name":"اوکلند","id":"Pacific/Auckland"},{"value":"Pacific/Bougainville","name":"بوگنویل","id":"Pacific/Bougainville"},{"value":"Pacific/Chatham","name":"چتم","id":"Pacific/Chatham"},{"value":"Pacific/Easter","name":"ایستر","id":"Pacific/Easter"},{"value":"Pacific/Efate","name":"افاته","id":"Pacific/Efate"},{"value":"Pacific/Enderbury","name":"اندربری","id":"Pacific/Enderbury"},{"value":"Pacific/Fakaofo","name":"فاکائوفو","id":"Pacific/Fakaofo"},{"value":"Pacific/Fiji","name":"فیجی","id":"Pacific/Fiji"},{"value":"Pacific/Funafuti","name":"فونافوتی","id":"Pacific/Funafuti"},{"value":"Pacific/Galapagos","name":"گالاپاگوس","id":"Pacific/Galapagos"},{"value":"Pacific/Gambier","name":"گامبیر","id":"Pacific/Gambier"},{"value":"Pacific/Guadalcanal","name":"گوادال‌کانال","id":"Pacific/Guadalcanal"},{"value":"Pacific/Guam","name":"گوام","id":"Pacific/Guam"},{"value":"Pacific/Honolulu","name":"هونولولو","id":"Pacific/Honolulu"},{"value":"Pacific/Johnston","name":"جانستون","id":"Pacific/Johnston"},{"value":"Pacific/Kiritimati","name":"کریتیماتی","id":"Pacific/Kiritimati"},{"value":"Pacific/Kosrae","name":"کوسرای","id":"Pacific/Kosrae"},{"value":"Pacific/Kwajalein","name":"کواجیلین","id":"Pacific/Kwajalein"},{"value":"Pacific/Majuro","name":"ماجورو","id":"Pacific/Majuro"},{"value":"Pacific/Marquesas","name":"مارکوزه","id":"Pacific/Marquesas"},{"value":"Pacific/Midway","name":"میدوی","id":"Pacific/Midway"},{"value":"Pacific/Nauru","name":"نائورو","id":"Pacific/Nauru"},{"value":"Pacific/Niue","name":"نیوئه","id":"Pacific/Niue"},{"value":"Pacific/Norfolk","name":"نورفولک","id":"Pacific/Norfolk"},{"value":"Pacific/Noumea","name":"نومئا","id":"Pacific/Noumea"},{"value":"Pacific/Pago_Pago","name":"پاگوپاگو","id":"Pacific/Pago_Pago"},{"value":"Pacific/Palau","name":"پالائو","id":"Pacific/Palau"},{"value":"Pacific/Pitcairn","name":"پیت‌کرن","id":"Pacific/Pitcairn"},{"value":"Pacific/Ponape","name":"پانپی","id":"Pacific/Ponape"},{"value":"Pacific/Port_Moresby","name":"پورت‌مورزبی","id":"Pacific/Port_Moresby"},{"value":"Pacific/Rarotonga","name":"راروتونگا","id":"Pacific/Rarotonga"},{"value":"Pacific/Saipan","name":"سایپان","id":"Pacific/Saipan"},{"value":"Pacific/Tahiti","name":"تاهیتی","id":"Pacific/Tahiti"},{"value":"Pacific/Tarawa","name":"تاراوا","id":"Pacific/Tarawa"},{"value":"Pacific/Tongatapu","name":"تونگاتاپو","id":"Pacific/Tongatapu"},{"value":"Pacific/Truk","name":"چوک","id":"Pacific/Truk"},{"value":"Pacific/Wake","name":"ویک","id":"Pacific/Wake"},{"value":"Pacific/Wallis","name":"والیس","id":"Pacific/Wallis"}];
};

return moment;
})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
