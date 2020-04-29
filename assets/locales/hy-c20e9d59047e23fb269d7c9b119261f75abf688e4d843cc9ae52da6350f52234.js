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
I18n._compiledMFs = {"topic.read_more_MF" : function(d){
var r = "";
r += " ";
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
r += "/unread'>1 չկարդացած</a> ";
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
})() + " չկարդացած</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "Կա";
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
r += "/new'>1 նոր</a> topic";
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
r += "and ";
return r;
},
"false" : function(d){
var r = "";
r += "կա ";
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
})() + " նոր</a> թեմա";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " , կամ ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
r += "դիտեք այլ թեմաներ ";
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
r += "Դուք պատրաստվում եք ջնջել այս օգտատիրոջ ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> գրառումը";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> գրառումները";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " և ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "<b>1</b> թեման";
return r;
},
"other" : function(d){
var r = "";
r += "<b>" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "</b> թեմաները";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " , ջնջել նրա հաշիվը, արգելափակել մուտքը նրա <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["ip_address"];
r += "</b> IP-ից և ավելացնել նրա <b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["email"];
r += "</b> էլ հասցեն մշտական արգելափակվածների ցանկին: Դուք համոզվա՞ծ եք, որ այս օգտատերն իրոք սպամ տարածող է:";
return r;
}, "posts_likes_MF" : function(d){
var r = "";
r += "Այս թեման ունի ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "count";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 պատասխան";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " պատասխան";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "ratio";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"low" : function(d){
var r = "";
r += "գրառման հավանումների բարձր հարաբերակցությամբ";
return r;
},
"med" : function(d){
var r = "";
r += "գրառման հավանումների շատ բարձր հարաբերակցությամբ";
return r;
},
"high" : function(d){
var r = "";
r += "գրառման հավանումների չափազանց բարձր հարաբերակցությամբ";
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
r += "Դուք պատրաստվում եք ջնջել ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "POSTS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 գրառում";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " գրառում";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " և ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "TOPICS";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 թեմա";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " թեմա";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ": Դուք համոզվա՞ծ եք:";
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
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
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
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。此消息仅管理人员可见。";
return r;
}, "logs_error_rate_notice.reached_hour_MF" : function(d){
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
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>达到了站点设置中的限制";
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
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.reached_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
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
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经达到站点设置限制 ";
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
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
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
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>超出了站点设置中的限制";
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
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "logs_error_rate_notice.exceeded_minute_MF" : function(d){
var r = "";
r += "<b>";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["relativeAge"];
r += "</b>1 – <a href='";
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
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "</a>已经超出站点设置限制 ";
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
})() + " error/minute";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " errors/minute";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["hy"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "。";
return r;
}, "topic.bumped_at_title_MF" : function(){ return "Invalid Format: Uncaught SyntaxError: Expected [a-zA-Z$_] but \"%u9996\" found. at undefined:1376:10";}};
MessageFormat.locale.hy = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
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

I18n.translations = {"hy":{"js":{"number":{"format":{"separator":".","delimiter":","},"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Բայթ","other":"Բայթ"},"gb":"ԳԲ","kb":"ԿԲ","mb":"ՄԲ","tb":"ՏԲ"}}},"short":{"thousands":"{{number}}հզ","millions":"{{number}}մլն"}},"dates":{"time":"h:mm","time_with_zone":"h:mm (z)","timeline_date":"MMM YYYY","long_no_year_no_time":"MMM D","full_no_year_no_time":"MMMM Do","long_with_year":"MMM D, YYYY h:mm a","long_with_year_no_time":"MMM D, YYYY","full_with_year_no_time":"MMMM Do, YYYY","long_date_with_year":"MMM D, 'YY LT","long_date_without_year":"MMM D, LT","long_date_with_year_without_time":"MMM D, 'YY","long_date_without_year_with_linebreak":"MMM D \u003cbr/\u003eLT","long_date_with_year_with_linebreak":"MMM D, 'YY \u003cbr/\u003eLT","wrap_ago":"%{date} առաջ","tiny":{"half_a_minute":"\u003c 1ր","less_than_x_seconds":{"one":"\u003c %{count}վրկ","other":"\u003c %{count}վ"},"x_seconds":{"one":"%{count}վրկ","other":"%{count}վ"},"less_than_x_minutes":{"one":"\u003c %{count}ր","other":"\u003c %{count}ր"},"x_minutes":{"one":"%{count}ր","other":"%{count}ր"},"about_x_hours":{"one":"%{count}ժ","other":"%{count}ժ"},"x_days":{"one":"%{count}օր","other":"%{count}օր"},"x_months":{"one":"%{count}ամիս","other":"%{count}ամիս"},"about_x_years":{"one":"%{count}տարի","other":"%{count}տ"},"over_x_years":{"one":"\u003e %{count}տարի","other":"\u003e %{count}տ"},"almost_x_years":{"one":"%{count}տարի","other":"%{count}տ"},"date_month":"MMM D","date_year":"MMM 'YY"},"medium":{"x_minutes":{"one":"%{count} րոպե","other":"%{count} րոպե"},"x_hours":{"one":"%{count} ժամ","other":"%{count} ժամ"},"x_days":{"one":"%{count} օր","other":"%{count} օր"},"date_year":"MMM D, 'YY"},"medium_with_ago":{"x_minutes":{"one":"%{count} րոպե առաջ","other":"%{count} րոպե առաջ"},"x_hours":{"one":"%{count} ժամ առաջ","other":"%{count} ժամ առաջ"},"x_days":{"one":"%{count} օր առաջ","other":"%{count} օր առաջ"},"x_months":{"one":"%{count} ամիս առաջ","other":"%{count} ամիս առաջ"},"x_years":{"one":"%{count} տարի առաջ","other":"%{count} տարի առաջ"}},"later":{"x_days":{"one":"%{count} օր հետո","other":"%{count} օր անց"},"x_months":{"one":"%{count} ամիս հետո","other":"%{count} ամիս անց"},"x_years":{"one":"%{count} տարի հետո","other":"%{count} տարի անց"}},"previous_month":"Նախորդ Ամիս","next_month":"Հաջորդ Ամիս","placeholder":"ամսաթիվ"},"share":{"topic_html":"Թեմա՝ \u003cspan class=\"topic-title\"\u003e%{topicTitle}\u003c/span\u003e","post":"գրառում #%{postNumber}","close":"փակել","twitter":"Կիսվել այս հղումով Twitter -ում","facebook":"Կիսվել այս հղումով Facebook -ում","email":"Ուղարկել այս հղումը էլ. նամակով"},"action_codes":{"public_topic":"այս թեման դարձրել է հրապարակային %{when}","private_topic":"այս թեման դարձրել է անձնական նամակ %{when}","split_topic":"բաժանել է այս թեման %{when}","invited_user":"հրավիրված է %{who}-ին %{when}","invited_group":"հրավիրված %{who}-ին %{when}","user_left":"%{who}-ը հեռացրել է իրեն այս հաղորդագրությունից %{when}","removed_user":"հեռացրել է %{who}-ին %{when}","removed_group":"հեռացրել է %{who}-ին %{when}","autobumped":"ավտոմատ կերպով բարձրացված է %{when}","autoclosed":{"enabled":"փակվել է %{when}","disabled":"բացվել է %{when}"},"closed":{"enabled":"փակվել է %{when}","disabled":"բացվել է %{when}"},"archived":{"enabled":"արխիվացվել է %{when}","disabled":"ապարխիվացվել է %{when}"},"pinned":{"enabled":"ամրակցվել է %{when}","disabled":"ապակցվել է %{when}"},"pinned_globally":{"enabled":"գլոբալ ամրակցվել է %{when}","disabled":"ապակցվել է %{when}"},"visible":{"enabled":"ցուցակագրվել է %{when}","disabled":"չցուցակագրված %{when}"},"banner":{"enabled":"սա դարձրել է բաններ %{when}: Այն կհայտնվի յուրաքանչյուր էջի վերևում, մինչև չհեռացվի օգտատիրոջ կողմից:","disabled":"հեռացրել է այս բանները %{when}: Այն այլևս չի հայտնվի յուրաքանչյուր էջի վերևում:"}},"wizard_required":"Բարի գալուստ Ձեր նոր Discourse! Սկսենք \u003ca href='%{url}' data-auto-route='true'\u003eտեղակայման մասնագետ\u003c/a\u003e-ի հետ ✨","emails_are_disabled":"Բոլոր ելքային էլ. նամակները անջատվել են ադմինիստրատորի կողմից: Էլ. փոստով ոչ մի տեսակի ծանուցում չի ուղարկվի:","bootstrap_mode_enabled":"Ձեր նոր կայքի թողարկումը ավելի հեշտ դարձնելու համար Դուք գտնվում եք սկզբնաբեռնման(bootstrap) ռեժիմում: Բոլոր նոր օգտատերերին կտրվի վստահության մակարդակ 1, և կմիացվեն ամեն օր ստացվող ամփոփիչ էլ. նամակները: Սա ավտոմատ կերպով կանջատվի, երբ գրանցվի %{min_users} օգտատեր:","bootstrap_mode_disabled":"Սկզբնաբեռնման(Bootstrap) ռեժիմը կանջատվի 24 ժամվա ընթացքում:","themes":{"default_description":"Լռելյայն"},"s3":{"regions":{"ap_northeast_1":"Asia Pacific (Tokyo)","ap_northeast_2":"Asia Pacific (Seoul)","ap_south_1":"Asia Pacific (Mumbai)","ap_southeast_1":"Asia Pacific (Singapore)","ap_southeast_2":"Asia Pacific (Sydney)","ca_central_1":"Canada (Central)","cn_north_1":"China (Beijing)","cn_northwest_1":"China (Ningxia)","eu_central_1":"EU (Frankfurt)","eu_north_1":"EU (Stockholm)","eu_west_1":"EU (Ireland)","eu_west_2":"EU (London)","eu_west_3":"EU (Paris)","sa_east_1":"South America (São Paulo)","us_east_1":"US East (N. Virginia)","us_east_2":"US East (Ohio)","us_gov_east_1":"AWS GovCloud (US-East)","us_west_1":"US West (N. California)","us_west_2":"US West (Oregon)"}},"edit":"խմբագրել այս թեմայի վերնագիրը և կատեգորիան","expand":"Ընդլայնել","not_implemented":"Այդ հատկանիշը դեռևս չի իրագործվել, ներողություն!","no_value":"Ոչ","yes_value":"Այո","submit":"Հաստատել","generic_error":"Տեղի է ունեցել սխալ, ներողություն:","generic_error_with_reason":"Տեղի է ունեցել սխալ՝ %{error}","go_ahead":"Գնալ առաջ","sign_up":"Գրանցվել","log_in":"Մուտք","age":"Տարիք","joined":"Միացել է ","admin_title":"Ադմին","show_more":"ցույց տալ ավելին","show_help":"տարբերակներ","links":"Հղումներ","links_lowercase":{"one":"հղում","other":"հղումներ"},"faq":"ՀՏՀ","guidelines":"Ուղեցույց","privacy_policy":"Գաղտնիության Քաղաքականություն","privacy":"Գաղտնիություն","tos":"Պայմանները","rules":"Կանոններ","conduct":"Վարքագծի Կանոններ","mobile_view":"Տեսքը Հեռախոսով","desktop_view":"Տեսքը Համակարգչով","you":"Դուք ","or":"կամ","now":"հենց նոր","read_more":"կարդալ ավելին","more":"Ավելին","less":"Կրճատ","never":"երբեք","every_30_minutes":"30 րոպեն մեկ","every_hour":"ժամը մեկ","daily":"ամեն օր","weekly":"շաբաթական","every_month":"ամիսը մեկ","every_six_months":"վեց ամիսը մեկ","max_of_count":"առավելագույնը {{count}}","alternation":"կամ","character_count":{"one":"{{count}} սիմվոլ","other":"{{count}} սիմվոլ"},"related_messages":{"title":" Առնչվող Հաղորդագրություններ","see_all":"Տեսնել %{username}-ի @\u003ca href=\"%{path}\"\u003eբոլոր նամակները\u003c/a\u003e"},"suggested_topics":{"title":"Առաջարկվող Թեմաներ","pm_title":"Առաջարկվող Հաղորդագրություններ"},"about":{"simple_title":"Մեր Մասին","title":" %{title}-ի մասին","stats":"Կայքի Վիճակագրություն","our_admins":"Մեր Ադմինները","our_moderators":"Մեր Մոդերատորները","moderators":"Մոդերատորներ","stat":{"all_time":"Ամբողջ Ժամանակ","last_7_days":"Վերջին 7 օրում","last_30_days":"Վերջին 30 օրում"},"like_count":"Հավանումներ","topic_count":"Թեմաներ","post_count":"Գրառում","user_count":"Օգտատերեր","active_user_count":"Ակտիվ Օգտատերեր","contact":"Հետադարձ Կապ","contact_info":"Այս կայքի հետ կապված կրիտիկական խնդիրների կամ հրատապ հարցերի դեպքում խնդրում ենք կապվել մեզ հետ %{contact_info} էլ. հասցեով:"},"bookmarked":{"title":"Էջանշել","clear_bookmarks":"Ջնջել Էջանշանները","help":{"bookmark":"Սեղմեք՝ այս թեմայի առաջին գրառումն էջանշելու համար","unbookmark":"Սեղմեք՝ այս թեմայի բոլոր էջանշանները ջնջելու համար"}},"bookmarks":{"created":"Դուք էջանշել եք այս գրառումը","not_bookmarked":"Էջանշել այս գրառումը","remove":"Հեռացնել էջանշանը","confirm_clear":"Դուք համոզվա՞ծ եք, որ ցանկանում եք հեռացնել այս թեմայի բոլոր էջանշանները:","save":"Պահպանել","reminders":{"later_today":"Այսօր, մի փոքր ուշ","tomorrow":"Վաղը","next_week":"Հաջորդ շաբաթ","later_this_week":"Այս շաբաթ, մի փոքր ավելի ուշ","next_month":"Հաջորդ ամիս"}},"drafts":{"resume":"Վերսկսել","remove":"Ջնջել","new_topic":"Նոր թեմայի սևագիր","new_private_message":"Նոր անձնական հաղորդագրության սևագիր","topic_reply":"Պատասխանի սևագիր","abandon":{"confirm":"Դուք արդեն բացել եք մեկ այլ սևագիր այս թեմայում: Դուք համոզվա՞ծ եք, որ ցանկանում եք հրաժարվել դրանից:","yes_value":"Այո, հրաժարվել","no_value":"Ոչ, պահել"}},"topic_count_latest":{"one":"Տեսնել {{count}} նոր կամ թարմացված թեման","other":"Դիտել {{count}} նոր կամ թարմացված թեմաները"},"topic_count_unread":{"one":"Տեսնել {{count}} չկարդացած թեման","other":"Դիտել {{count}} չկարդացած թեմաները"},"topic_count_new":{"one":"Տեսնել {{count}} նոր թեման","other":"Դիտել {{count}} նոր թեմաները"},"preview":"նախադիտում","cancel":"չեղարկել","save":"Պահպանել Փոփոխությունները","saving":"Պահպանվում է...","saved":"Պահված է!","upload":"Վերբեռնել","uploading":"Վերբեռնվում է...","uploading_filename":"Վերբեռնվում է՝ {{filename}}...","clipboard":"փոխանակման հարթակ","uploaded":"Վերբեռնված է !","pasting":"Տեղադրվում է...","enable":"Միացնել","disable":"Անջատել","continue":"Շարունակել","undo":"Ետարկել","revert":"Հետադարձել","failed":"Ձախողում","switch_to_anon":"Սկսել Անանուն Ռեժիմը","switch_from_anon":"Ավարտել Անանուն Ռեժիմը","banner":{"close":"Փակել այս բանները","edit":"Խմբագրել այս բանները \u003e\u003e"},"pwa":{"install_banner":"Դուք ցանկանու՞մ եք \u003ca href\u003eտեղադրել %{title}-ը այս սարքի վրա?\u003c/a\u003e"},"choose_topic":{"none_found":"Թեմաներ չեն գտնվել"},"choose_message":{"none_found":"Հաղորդագրություններ չեն գտնվել:"},"review":{"order_by":"Դասավորել ըստ","in_reply_to":"ի պատասխան","explain":{"formula":"Բանաձև","total":"Ամբողջը"},"delete":"Ջնջել","settings":{"save_changes":"Պահպանել Փոփոխությունները","title":"Կարգավորումներ"},"moderation_history":"Մոդերացիայի Պատմությունը","topic":"Թեմա՝","filtered_user":"Օգտատեր","user":{"username":"Օգտանուն","email":"Էլ. հասցե","name":"Անուն"},"topics":{"topic":"Թեմա","reviewable_count":"Քանակ","details":"մանրամասները"},"edit":"Խմբագրել","save":"Պահպանել","cancel":"Չեղարկել","filters":{"all_categories":"(Բոլոր կատեգորիաները)","type":{"title":"Տիպ"},"refresh":"Թարմացնել","category":"Կատեգորիա","priority":{"high":"Կարևոր"}},"scores":{"score":"Միավոր","date":"Ամսաթիվ","type":"Տիպ"},"statuses":{"pending":{"title":"Սպասող"},"rejected":{"title":"Մերժված"},"ignored":{"title":"Անտեսված"}},"types":{"reviewable_user":{"title":"Օգտատեր"}},"approval":{"title":"Գրառումը Հաստատման Կարիք Ունի","description":"Մենք ստացել ենք Ձեր նոր գրառումը, սակայն այն պետք է հաստատվի մոդերատորի կողմից մինչև ցուցադրվելը: Խնդրում ենք սպասել:","ok":"ՕԿ"}},"user_action":{"user_posted_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e-ը հրապարակել է \u003ca href='{{topicUrl}}'\u003eայս թեման\u003c/a\u003e","you_posted_topic":"\u003ca href='{{userUrl}}'\u003eԴուք\u003c/a\u003e հրապարակել եք \u003ca href='{{topicUrl}}'\u003eայս թեման\u003c/a\u003e","user_replied_to_post":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e-ը պատասխանել է \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e գրառմանը","you_replied_to_post":"\u003ca href='{{userUrl}}'\u003eԴուք\u003c/a\u003e պատասխանել եք \u003ca href='{{postUrl}}'\u003e{{post_number}}\u003c/a\u003e գրառմանը","user_replied_to_topic":"\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e-ը պատասխանել է \u003ca href='{{topicUrl}}'\u003eայս թեմային\u003c/a\u003e","you_replied_to_topic":"\u003ca href='{{userUrl}}'\u003eԴուք\u003c/a\u003e պատասխանել եք \u003ca href='{{topicUrl}}'\u003eայս թեմային\u003c/a\u003e","user_mentioned_user":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e-ը հիշատակել է \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e-ին","user_mentioned_you":"\u003ca href='{{user1Url}}'\u003e{{user}}\u003c/a\u003e-ը հիշատակել է \u003ca href='{{user2Url}}'\u003eՁեզ\u003c/a\u003e","you_mentioned_user":"\u003ca href='{{user1Url}}'\u003eԴուք\u003c/a\u003e հիշատակել եք \u003ca href='{{user2Url}}'\u003e{{another_user}}\u003c/a\u003e-ին","posted_by_user":"Հրապարակվել է \u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e-ի կողմից","posted_by_you":"Հրապարակվել է \u003ca href='{{userUrl}}'\u003eՁեր\u003c/a\u003e կողմից","sent_by_user":"Ուղարկվել է\u003ca href='{{userUrl}}'\u003e{{user}}\u003c/a\u003e-ի կողմից","sent_by_you":"Ուղարկվել է \u003ca href='{{userUrl}}'\u003eՁեր\u003c/a\u003eկողմից"},"directory":{"filter_name":"ֆիլտրել ըստ օգտանվան","title":"Օգտատերեր","likes_given":"Տրված","likes_received":"Ստացած","topics_entered":"Դիտված","topics_entered_long":"Դիտված Թեմաները","time_read":"Կարդացած Ժամանակը","topic_count":"Թեմա","topic_count_long":"Ստեղծված Թեմա","post_count":"Պատասխան","post_count_long":"Հրապարակված Պատասխան","no_results":"Արդյունքներ չեն գտնվել:","days_visited":"Այցելություն","days_visited_long":"Այցելության Օր","posts_read":"Կարդացած","posts_read_long":"Կարդացած Գրառում","total_rows":{"one":"%{count} օգտատեր","other":"%{count} օգտատեր"}},"group_histories":{"actions":{"change_group_setting":"Փոխել խմբի կարգավորումը","add_user_to_group":"Ավելացնել օգտատեր","remove_user_from_group":"Հեռացնել օգտատիրոջը","make_user_group_owner":"Դարձնել սեփականատեր","remove_user_as_group_owner":"Հետ կանչել սեփականատիրոջ թույլտվությունը"}},"groups":{"member_added":"Ավելացված","add_members":{"title":"Ավելացնել Անդամներ","description":"Կառավարել այս խմբի անդամակցությունը","usernames":"Օգտանուններ"},"requests":{"reason":"Պատճառ","accepted":"ընդունված"},"manage":{"title":"Կառավարել","name":"Անուն","full_name":"Անուն Ազգանուն","add_members":"Ավելացնել Անդամներ","delete_member_confirm":"Հեռացնե՞լ '%{username}' օգտանունը '%{group}' խմբից:","profile":{"title":"Պրոֆիլ"},"interaction":{"title":"Փոխազդեցություն","posting":"Հրապարակում","notification":"Ծանուցում"},"membership":{"title":"Անդամակցություն","access":"Թույլտվություն"},"logs":{"title":"Գրառումներ","when":"Երբ","action":"Գործողություն","acting_user":"Կատարող օգտատեր","target_user":"Նպատակային օգտատեր","subject":"Թեմա","details":"Մանրամասներ","from":"Ումից","to":"Ում"}},"public_admission":"Թույլ տալ օգտատերերին ազատ կերպով միանալ խմբին (Խումբը պետք է լինի հրապարակային)","public_exit":"Թույլ տալ օգտատերերին ազատ կերպով լքել խումբը","empty":{"posts":"Այս խմբի անդամների կողմից գրառումներ չկան:","members":"Այս խմբում անդամներ չկան:","mentions":"Այս խմբի հիշատակումներ չկան:","messages":"Այս խմբի համար հաղորդագրություններ չկան:","topics":"Այս խմբի անդամների կողմից թեմաներ չկան:","logs":"Այս խմբի համար գրառումներ չկան:"},"add":"Ավելացնել","join":"Միանալ","leave":"Լքել","request":"Հարցում","message":"Հաղորդագրություն","membership_request_template":"Մասնավոր ձևանմուշ, որը կցուցադրվի օգտատերերին՝ անդամակցության հարցում ուղարկելիս","membership_request":{"submit":"Ուղարկել Հարցում","title":" @%{group_name}-ին միանալու հարցում","reason":"Տեղեկացրեք խմբի սեփականատերերին, թե ինչու եք ցանկանում միանալ այս խմբին"},"membership":"Անդամակցություն","name":"Անուն","group_name":"Խմբի անուն","user_count":"Օգտատեր","bio":"Խմբի Մասին ","selector_placeholder":"մուտքագրեք օգտանունը","owner":"սեփականատեր","index":{"title":"Խմբեր","all":"Բոլոր Խմբերը","empty":"Տեսանելի խմբեր չկան:","filter":"Ֆիլտրել ըստ խմբի տիպի","owner_groups":"Խմբերը, որտեղ ես սեփականատեր եմ","close_groups":"Փակված Խմբեր","automatic_groups":"Ավտոմատ Խմբեր","automatic":"Ավտոմատ","closed":"Փակված","public":"Հրապարակային","private":"Գաղտնի","public_groups":"Հրապարակային Խմբեր","automatic_group":"Ավտոմատ Խումբ","close_group":"Փակել Խումբը","my_groups":"Իմ Խմբերը","group_type":"Խմբի տիպը","is_group_user":"Անդամ","is_group_owner":"Սեփականատեր"},"title":{"one":"Խումբ","other":"Խմբեր"},"activity":"Ակտիվություն","members":{"title":"Անդամներ","filter_placeholder_admin":"օգտանուն կամ էլ. փոստի հասցե","filter_placeholder":"օգտանուն","remove_member":"Հեռացնել Խմբից","remove_member_description":"Հեռացնել \u003cb\u003e%{username}\u003c/b\u003e-ին այս խմբից","make_owner":"Դարձնել Սեփականատեր","make_owner_description":"Դարձնել \u003cb\u003e%{username}\u003c/b\u003e-ին այս խմբի սեփականատեր","remove_owner":"Զրկել սեփականատիրոջ իրավունքից","remove_owner_description":"Զրկել \u003cb\u003e%{username}\u003c/b\u003e-ին այս խմբի սեփականատիրոջ իրավունքից","owner":"Սեփականատեր"},"topics":"Թեմաներ","posts":"Գրառումներ","mentions":"Հիշատակումներ","messages":"Հաղորդագրություններ","notification_level":"Խմբակային հաղորդագրությունների համար լռելյայն ծանուցումների կարգավիճակը","alias_levels":{"mentionable":"Ո՞վ կարող է @հիշատակել այս խումբը:","messageable":"Ո՞վ կարող է հաղորդագրություն ուղարկել այս խմբին:","nobody":"Ոչ ոք","only_admins":"Միայն ադմինները","mods_and_admins":"Միայն մոդերատորները և ադմինները","members_mods_and_admins":"Միայն խմբի անդամները, մոդերատորները և ադմինները","everyone":"Բոլորը"},"notifications":{"watching":{"title":"Դիտում Եմ","description":"Դուք ծանուցում կստանաք յուրաքանչյուր հաղորդագրության յուրաքանչյուր գրառման մասին, և կցուցադրվի նոր պատասխանների քանակը:"},"watching_first_post":{"title":"Դիտում Եմ Առաջին Գրառումը","description":"Դուք ծանուցում կստանաք այս խմբի նոր հաղորդագրությունների մասին, բայց ոչ հաղորդագրությունների պատասխանների:"},"tracking":{"title":"Հետևում Եմ","description":"Դուք ծանուցում կստանաք, եթե որևէ մեկը հիշատակի Ձեր @անունը կամ պատասխանի Ձեզ, և կցուցադրվի նոր պատասխանների քանակը:"},"regular":{"title":"Սովորական","description":"Դուք ծանուցում կստանաք, եթե որևէ մեկը հիշատակի Ձեր @անունը կամ պատասխանի Ձեզ:"},"muted":{"title":"Խլացված","description":"Այս խմբի նոր հաղորդագրությունների հետ կապված Դուք երբեք որևէ ծանուցում չեք ստանա:"}},"flair_url":"Avatar Flair Նկար","flair_url_placeholder":"(Ընտրովի) Նկարի URL կամ Font Awesome class","flair_url_description":"Օգտագործեք քառակուսի նկար, ոչ փոքր քան 20պքս x 20պքս չափից կամ FontAwesome պատկերակներ (ընդունելի ֆորմատներ՝ \"fa-icon\", \"far fa-icon\" կամ \"fab fa-icon\"):","flair_bg_color":"Avatar Flair Ֆոնի Գույն","flair_bg_color_placeholder":"(Ընտրովի) Գույնի Hex արժեք","flair_color":"Avatar Flair Գույն","flair_color_placeholder":"(Ընտրովի) Գույնի Hex արժեք","flair_preview_icon":"Նախադիտման Պատկերակ","flair_preview_image":"Նախադիտման Նկար"},"user_action_groups":{"1":"Տրված Հավանումներ","2":"Ստացած Հավանումներ","3":"Էջանշաններ","4":"Թեմաներ","5":"Պատասխաններ","6":"Արձագանքներ","7":"Հիշատակումներ","9":"Մեջբերումներ","11":"Խմբագրումներ","12":"Ուղարկված","13":"Մուտքի արկղ","14":"Սպասող","15":"Սևագրեր"},"categories":{"all":"բոլոր կատեգորիաները","all_subcategories":"բոլորը","no_subcategory":"ոչ մեկը","category":"Կատեգորիա","category_list":"Ցուցադրել կատեգորիաների ցանկը","reorder":{"title":"Վերադասավորել Կատեգորիաները","title_long":"Վերակազմավորել կատեգորիաների ցանկը","save":"Պահպանել Դասավորությունը","apply_all":"Կիրառել","position":"Դիրքը"},"posts":"Գրառումներ","topics":"Թեմաներ","latest":"Վերջինները","latest_by":"վերջինները ըստ","toggle_ordering":"փոխանջատել դասավորման կառավորումը","subcategories":"Ենթակատեգորիաներ","topic_sentence":{"one":"%{count} թեմա","other":"%{count} թեմա"},"topic_stat_sentence_week":{"one":"%{count} նոր թեմա անցյալ շաբաթվա ընթացքում","other":"%{count} նոր թեմա անցյալ շաբաթվա ընթացքում:"},"topic_stat_sentence_month":{"one":"%{count} նոր թեմա անցյալ ամսվա ընթացքում","other":"%{count} նոր թեմա անցյալ ամսվա ընթացքում:"},"n_more":"Կատեգորիաներ (ևս %{count}) ..."},"ip_lookup":{"title":"IP Հասցեի Որոնում","hostname":"Հոսթի անունը","location":"Վայրը","location_not_found":"(անհայտ)","organisation":"Կազմակերպություն","phone":"Հեռախոս","other_accounts":"Այլ հաշիվներ այս IP հասցեով՝","delete_other_accounts":"Ջնջել %{count}","username":"օգտանուն","trust_level":"ՎՄ","read_time":"կարդացած ժամանակը","topics_entered":"մուտքագրված թեմաներ","post_count":"# գրառում","confirm_delete_other_accounts":"Դուք համոզվա՞ծ եք, որ ցանկանում եք ջնջել այս հաշիվները:","powered_by":"օգտագործվում է՝ \u003ca href='https://maxmind.com'\u003eMaxMindDB\u003c/a\u003e","copied":"կրկօրինակված"},"user_fields":{"none":"(ընտրել)"},"user":{"said":"{{username}} ՝","profile":"Պրոֆիլ","mute":"Խլացնել","edit":"Խմբագրել Նախընտրությունները","download_archive":{"button_text":"Ներբեռնել Բոլորը","confirm":"Դուք համոզվա՞ծ եք, որ ցանկանում եք ներբեռնել Ձեր գրառումները:","success":"Ներբեռնումը սկսված է, Դուք կստանաք ծանուցում հաղորդագրության միջոցով, երբ գործընթացն ավարտվի:","rate_limit_error":"Գրառումները կարելի է ներբեռնել միայն օրը մեկ անգամ, խնդրում ենք կրկին փորձել վաղը:"},"new_private_message":"Նոր Հաղորդագրություն","private_message":"Հաղորդագրություն","private_messages":"Հաղորդագրություններ","user_notifications":{"ignore_duration_username":"Օգտանուն","ignore_duration_save":"Անտեսել","ignore_duration_time_frame_required":"Խնդրում ենք ընտրել ժամանակահատված","ignore_option":"Անտեսված","mute_option":"Խլացված","normal_option":"Նորմալ"},"activity_stream":"Ակտիվություն","preferences":"Նախընտրություններ","feature_topic_on_profile":{"save":"Պահպանել","clear":{"title":"Ջնջել"}},"profile_hidden":"Այս օգտատիրոջ հրապարակային պրոֆիլը թաքցրած է:","expand_profile":"Ընդլայնել","collapse_profile":"Կրճատել","bookmarks":"Էջանշաններ","bio":"Իմ մասին","invited_by":"Ում կողմից է հրավիրված","trust_level":"Վստահության Մակարդակ","notifications":"Ծանուցումներ","statistics":"Վիճակագրություն","desktop_notifications":{"label":"Այժմեական(Live) Ծանուցումներ","not_supported":"Այս բրաուզերը չի ապահովում ծանուցումներ, ներողություն:","perm_default":"Միացնել Ծանուցումները","perm_denied_btn":"Թույլտվությունը Մերժված է","perm_denied_expl":"Դուք մերժել եք ծանուցումների թույլտվությունը: Թույլատրեք ծանուցումները Ձեր բրաուզերի կարգավորումներից:","disable":"Անջատել Ծանուցումները","enable":"Միացնել Ծանուցումները","each_browser_note":"Ծանոթություն: Դուք պետք է փոխեք այս կարգավորումը Ձեր օգտագործած յուրաքանչյուր բրաուզերի համար:","consent_prompt":"Դուք ցանկանո՞ւմ եք ստանալ այժմեական ծանուցումներ, երբ մարդիկ պատասխանեն Ձեր գրառումներին:"},"dismiss":"Չեղարկել","dismiss_notifications":"Չեղարկել Բոլորը","dismiss_notifications_tooltip":"Նշել բոլոր չկարդացած ծանուցումները որպես կարդացած:","first_notification":"Ձեր առաջին ծանուցումն է! Ընտրեք այն՝ սկսելու համար:","theme_default_on_all_devices":"Դարձնել սա լռելյայն թեմա իմ բոլոր սարքավորումների համար","text_size_default_on_all_devices":"Դարձնել սա լռելյայն տեքստի չափ իմ բոլոր սարքավորում համար","allow_private_messages":"Թույլ տալ այլ օգտատերերին ուղարկել ինձ անձնական հաղորդագրություններ","external_links_in_new_tab":"Բացել բոլոր արտաքին հղումները նոր ներդիրում(tab)","enable_quoting":"Միացնել մեջբերմամբ պատասխանելը ընդգծված տեքստի համար","change":"փոխել","moderator":"{{user}}-ը մոդերատոր է","admin":"{{user}}-ը ադմին է","moderator_tooltip":"Այս օգտատերը մոդերատոր է","admin_tooltip":"Այս օգտատերն ադմին է","silenced_tooltip":"Այս օգտատերը լռեցված է","suspended_notice":"Այս օգտատերը սառեցված է մինչև {{date}}:","suspended_permanently":"Այս օգտատերը սառեցված է","suspended_reason":"Պատճառը՝ ","github_profile":"Github","email_activity_summary":"Ակտիվության Ամփոփում","mailing_list_mode":{"label":"Փոստային ցուցակի ռեժիմ","enabled":"Միացնել փոստային ցուցակի ռեժիմը","instructions":"Այս կարգավորումը վերասահմանում է ակտիվության ամփոփումը:\u003cbr /\u003e\nԽլացված թեմաները և կատեգորիաները ներառված չեն լինի այս էլ. նամակներում:\n","individual":"Ուղարկել էլ. նամակ յուրաքանչյուր նոր գրառման համար","individual_no_echo":"Ուղարկել էլ. նամակ յուրաքանչյուր նոր գրառման համար, բացառությամբ իմ սեփականների","many_per_day":"Ստանալ էլ. նամակ յուրաքանչյուր նոր գրառման համար (օրը մոտ {{dailyEmailEstimate}} հատ)","few_per_day":"Ստանալ էլ. նամակ յուրաքանչյուր նոր գրառման համար (օրը մոտ 2 հատ)","warning":"Փոստային ցուցակի ռեժիմը միացված է: Էլ. փոստով ծանուցումների կարգավորումները վերասահմանված են: "},"tag_settings":"Թեգեր","watched_tags":"Դիտված","watched_tags_instructions":"Դուք ավտոմատ կերպով կդիտեք այս թեգերով բոլոր թեմաները: Դուք կստանաք ծանուցում բոլոր նոր գրառումների և թեմաների մասին, և նոր գրառումների քանակը նաև կհայտնվի թեմայի կողքին:","tracked_tags":"Հետևած","tracked_tags_instructions":"Դուք ավտոմատ կերպով կհետևեք այս թեգերով բոլոր թեմաներին: Նոր գրառումների քանակը կհայտնվի թեմայի կողքին:","muted_tags":"Խլացված","muted_tags_instructions":"Այս թեգերով ոչ մի նոր հրապարակման մասին դուք ծանուցում չեք ստանա, և դրանք ցույց չեն տրվի վերջինների մեջ:","watched_categories":"Դիտված","watched_categories_instructions":"Դուք ավտոմատ կերպով կդիտեք այս կատեգորիաների բոլոր թեմաները: Դուք կստանաք ծանուցում բոլոր նոր գրառումների և թեմաների մասին, և նոր գրառումների քանակը նաև կհայտնվի թեմայի կողքին:","tracked_categories":"Հետևած","tracked_categories_instructions":"Դուք ավտոմատ կերպով կհետևեք այս կատեգորիաների բոլոր թեմաներին: Նոր գրառումների քանակը կհայտնվի թեմայի կողքին:","watched_first_post_categories":"Դիտում Եմ Առաջին Գրառումը","watched_first_post_categories_instructions":"Դուք կստանաք ծանուցում այս կատեգորիաների յուրաքանչյուր նոր թեմայի առաջին գրառման մասին:","watched_first_post_tags":"Դիտում Եմ Առաջին Գրառումը","watched_first_post_tags_instructions":"Դուք կստանաք ծանուցում այս թեգերով յուրաքանչյուր նոր թեմայում առաջին գրառման մասին:","muted_categories":"Խլացված","muted_categories_instructions":"Դուք չեք ստանա որևէ ծանուցում այս կատեգորիաների նոր թեմաների մասին, և դրանք չեն հայտնվի կատեգորիաներում կամ վերջին էջերում:","no_category_access":"Որպես մոդերատոր՝ Դուք ունեք կատեգորիաների սահմանափակ թույլտվություն, պահպանելն անջատված է:","delete_account":"Ջնջել Իմ Հաշիվը","delete_account_confirm":"Դուք համոզվա՞ծ եք, որ ցանկանում եք մշտապես ջնջել Ձեր հաշիվը: Այս գործողությունը չի կարող ետարկվել!","deleted_yourself":"Ձեր հաշիվը հաջողությամբ ջնջված է:","delete_yourself_not_allowed":"Եթե ցանկանում եք ջնջել Ձեր հաշիվը, խնդրում ենք կապ հաստատել անձնակազմի հետ:","unread_message_count":"Հաղորդագրություն","admin_delete":"Ջնջել","users":"Օգտատերեր","muted_users":"Խլացված","muted_users_instructions":"Արգելել այս օգտատերերից բոլոր ծանուցումները:","ignored_users":"Անտեսված","ignored_users_instructions":"Թաքցնել բոլոր գրառումները և ծանուցումները այս օգտատերերից:","tracked_topics_link":"Ցուցադրել","automatically_unpin_topics":"Ավտոմատ կերպով ապակցել թեմաները, երբ ես հասնեմ ներքև:","apps":"Հավելվածներ","revoke_access":"Հետ Կանչել Թույլտվությունը","undo_revoke_access":"Ետարկել Թույլտվության Հետկանչումը (Undo Revoke Access)","api_approved":"Հաստատված է՝","api_last_used_at":"Վերջին անգամ օգտագործվել է՝","theme":"Թեմա","home":"Լռելյայն Գլխավոր Էջ","staged":"Աստիճանավորված (Staged)","staff_counters":{"flags_given":"օգտակար դրոշակավորում","flagged_posts":"դրոշակավորված գրառում","deleted_posts":"ջնջված գրառում","suspensions":"սառեցում","warnings_received":"զգուշացում"},"messages":{"all":"Բոլորը","inbox":"Մուտքերի արկղ","sent":"Ուղարկված","archive":"Արխիվ","groups":"Իմ Խմբերը","bulk_select":"Ընտրել հաղորդագրություններ","move_to_inbox":"Տեղափոխել Մուտքերի արկղ","move_to_archive":"Արխիվացնել","failed_to_move":"Չհաջողվեց տեղափոխել ընտրված հաղորդագրությունները (հնարավոր է՝ համացանցի հետ կապված խնդիր կա)","select_all":"Ընտրել Բոլորը","tags":"Թեգեր"},"preferences_nav":{"account":"Հաշիվ","profile":"Պրոֆիլ","emails":"Էլ. հասցեներ","notifications":"Ծանուցումներ","categories":"Կատեգորիաներ","users":"Օգտատերեր","tags":"Թեգեր","interface":"Ինտերֆեյս","apps":"Հավելվածներ"},"change_password":{"success":"(էլ. նամակն ուղարկված է)","in_progress":"(էլ. նամակն ուղարկվում է)","error":"(սխալ)","action":"Ուղարկել Գաղտնաբառի Վերականգման Էլ. Նամակ","set_password":"Առաջադրել Գաղտնաբառ","choose_new":"Ընտրել նոր գաղտնաբառ","choose":"Ընտրել գաղտնաբառ"},"second_factor_backup":{"title":"Երկու գործոնով պահեստային կոդեր","regenerate":"Վերագեներացնել","disable":"Անջատել","enable":"Միացնել","enable_long":"Միացնել պահուստային կոդերը","copied_to_clipboard":"Կրնօրինակված է Փոխանակման հարթակում","copy_to_clipboard_error":"Փոխանակման հարթակում տվյալների կրկնօրինակման սխալ","remaining_codes":"Ձեզ մնացել է պահուստային \u003cstrong\u003e{{count}}\u003c/strong\u003e կոդ:","codes":{"title":"Պահուստային Կոդերը Գեներացվել են","description":"Այս պահուստային կոդերից յուրաքանչյուրը կարող է օգտագործվել միայն մեկ անգամ: Պահեք դրանք ապահով, բայց հասանելի վայրում:"}},"second_factor":{"title":"Երկգործոն վավերացում","confirm_password_description":"Շարունակելու համար խնդրում ենք հաստատել Ձեր գաղտնաբառը","name":"Անուն","label":"Կոդ","rate_limit":"Խնդրում ենք սպասել՝ նախքան մեկ այլ վավերացման կոդ փորձելը:","enable_description":"Սկանավորեք այս QR կոդը համապատասխան հավելվածում (\u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target=\"_blank\"\u003eAndroid\u003c/a\u003e – \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\" target=\"_blank\"\u003eiOS\u003c/a\u003e) և մուտքագրեք Ձեր նույնականացման կոդը:\n","disable_description":"Խնդրում ենք Ձեր հավելվածից մուտքագրել վավերացման կոդը:","show_key_description":"Մուտքագրել ձեռքով","extended_description":"Երկգործոն վավերացումն ավելացնում է էքստրա-անվտանգություն Ձեր հաշվին՝ պահանջելով մեկանգամյա կոդանշան(token)՝ ի հավելումն Ձեր գաղտնաբառին: Կոդանշանները կարող են գեներացվել \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+android\" target='_blank'\u003eAndroid\u003c/a\u003e և \u003ca href=\"https://www.google.com/search?q=authenticator+apps+for+ios\"\u003eiOS\u003c/a\u003e սարքերով:\n","oauth_enabled_warning":"Խնդրում ենք նկատի ունենալ, որ սոցիալական ցանցերով մուտքը կանջատվի, հենց որ երկգործոն վավերացումը միացվի Ձեր հաշվի համար:","enforced_notice":"Դուք պարտավոր եք միացնել երկգործոն նույնականացումը՝ մինչ մուտք գործելը այս կայք:","edit":"Խմբագրել","security_key":{"register":"Գրանցվել","delete":"Ջնջել"}},"change_about":{"title":"Փոփոխել Իմ Մասին բաժինը","error":"Այս արժեքը փոփոխելիս տեղի է ունեցել սխալ:"},"change_username":{"title":"Փոփոխել Օգտանունը","confirm":"Դուք միանշանակ համոզվա՞ծ եք, որ ցանկանում եք փոփոխել Ձեր օգտանունը:","taken":"Ներողություն, այդ օգտանունը զբաղված է:","invalid":"Այդ օգտանունն անվավեր է: Այն պետք է պարունակի միայն թվեր և տառեր:"},"change_email":{"title":"Փոփոխել Էլ. Հասցեն","taken":"Ներողություն, այդ էլ. հասցեն հասանելի չէ:","error":"Ձեր էլ. հասցեն փոփոխելիս տեղի է ունեցել սխալ: Միգուցե այդ հասցեն արդեն օգտագործվո՞ւմ է:","success":"Մենք ուղարկել ենք էլ. նամակ այդ հասցեին: Խնդրում ենք հետևել հաստատման հրահանգներին:","success_staff":"Մենք ուղարկել ենք էլ. նամակ Ձեր ընթացիկ հասցեին: Խնդրում ենք հետևել հաստատման հրահանգներին:"},"change_avatar":{"title":"Փոխել Ձեր պրոֆիլի նկարը","letter_based":"Համակարգի կողմից դրված պրոֆիլի նկար","uploaded_avatar":"Անհատական նկար","uploaded_avatar_empty":"Ավելացնել անհատական նկար","upload_title":"Վերբեռնեք Ձեր նկարը","image_is_not_a_square":"Ուշադրություն. մենք կտրել ենք Ձեր նկարը; լայնությունն ու երկարությունը հավասար չէին:"},"change_card_background":{"title":"Օգտատիրոջ Քարտի Ֆոն","instructions":"Ֆոնի նկարները կբերվեն կենտրոն և կունենան 590 պքս լռելյայն լայնություն:"},"email":{"title":"Էլ. հասցե","primary":"Հիմնական Էլ. հասցե","secondary":"Երկրորդական Էլ. հասցեներ","no_secondary":"Երկրորդական էլ. հասցեներ չկան","sso_override_instructions":"Էլ. հասցեն կարող է թարմացվել SSO մատակարարից:","instructions":"Երբեք չի ցուցադրվում հանրությանը","ok":"Հաստատման համար մենք Ձեզ կուղարկենք էլ. նամակ","invalid":"Խնդրում ենք մուտքագրել վավեր էլ. հասցե","authenticated":"Ձեր էլ. հասցեն վավերացվել է {{provider}}-ի կողմից","frequency_immediately":"Մենք անհապաղ Ձեզ էլ. նամակ կուղարկենք, եթե դեռևս Դուք դա չեք կարդացել կայքում:","frequency":{"one":"Մենք էլ. նամակ կուղարկենք Ձեզ միայն այն դեպքում, եթե մենք չենք տեսել Ձեզ վերջին րոպեի ընթացքում:","other":"Մենք Ձեզ էլ. նամակ կուղարկենք միայն այն դեպքում, եթե մենք չենք տեսել Ձեզ վերջին {{count}} րոպեի ընթացքում:"}},"associated_accounts":{"title":"Կապակցված Հաշիվներ","connect":"Կապել","revoke":"Հետ կանչել","cancel":"Չեղարկել","not_connected":"(չկապակցված)"},"name":{"title":"Անուն","instructions":"Ձեր անուն ազգանունը (ընտրովի)","instructions_required":"Ձեր անուն ազգանունը","too_short":"Ձեր անունը շատ կարճ է","ok":"Ձեր անունն ընդունված է"},"username":{"title":"Օգտանուն","instructions":"եզակի, առանց բացատների, կարճ","short_instructions":"Մարդիկ կարող են հիշատակել Ձեզ որպես @{{username}}","available":"Ձեր օգտանունը հասանելի է","not_available":"Հասանելի չէ: Փորձե՞լ {{suggestion}}-ը:","not_available_no_suggestion":"Հասանելի չէ","too_short":"Ձեր օգտանունը շատ կարճ է","too_long":"Ձեր օգտանունը շատ երկար է","checking":"Ստուգվում է օգտանվան հասանելիությունը...","prefilled":"Էլ. հասցեն համընկնում է գրանցված օգտանվան հետ"},"locale":{"title":"Ինտերֆեյսի լեզուն","instructions":"Օգտատիրոջ ինտերֆեյսի լեզուն: Այն կփոխվի, երբ Դուք թարմացնեք էջը:","default":"(լռելյայն)","any":"ցանկացած"},"password_confirmation":{"title":"Կրկնել Գաղտաբառը "},"auth_tokens":{"title":"Վերջերս Օգտագործված Սարքերը","ip":"IP","details":"Մանրամասներ","log_out_all":"Դուրս գրվել բոլոր սարքերից","active":"հիմա ակտիվ է","not_you":"Դուք չե՞ք:","show_all":"Ցուցադրել բոլորը ({{count}})","show_few":"Ցուցադրել ավելի քիչ","was_this_you":"Սա Դո՞ւք էիք:","was_this_you_description":"Եթե դա Դուք չէիք, մենք խորհուրդ ենք տալիս փոխել Ձեր գաղտնաբառը և դուրս գրվել բոլոր սարքերից: ","browser_and_device":"{{browser}} {{device}}-ի վրա","secure_account":"Ապահովագրել իմ Հաշիվը","latest_post":"Դուք վերջին անգամ հրապարակում կատարել եք..."},"last_posted":"Վերջին Գրառումը","last_emailed":"Վերջինը Նամակ Ուղարկվել է","last_seen":"Ակտիվ էր","created":"Միացել է","log_out":"Դուրս գրվել","location":"Վայրը","website":"Վեբ Կայք","email_settings":"Էլ. հասցե","hide_profile_and_presence":"Թաքցնել իմ հրապարակային պրոֆիլը և ներկայության հատկանիշները","enable_physical_keyboard":"Միացնել ֆիզիկական ստեղնաշարի ապահովումը iPad -ի վրա","text_size":{"title":"Տեքստի Չափը","smaller":"Ավելի փոքր","normal":"Նորմալ","larger":"Ավելի մեծ","largest":"Ամենամեծը"},"like_notification_frequency":{"title":"Ծանուցել հավանելու դեպքում","always":"Միշտ","first_time_and_daily":"Առաջին անգամ, երբ գրառումը հավանում են, և օրական","first_time":"Առաջին անգամ, երբ գրառումը հավանում են","never":"Երբեք"},"email_previous_replies":{"title":"Ներառել բոլոր նախորդ պատասխանները էլ. նամակների ներքևում","unless_emailed":"եթե նախկինում ուղարկված չէ","always":"միշտ","never":"երբեք"},"email_digests":{"title":"Երբ ես չեմ այցելում այստեղ, ուղարկեք ինձ ամփոփիչ էլ. նամակ տարածված թեմաների և պատասխանների մասին","every_30_minutes":"30 րոպեն մեկ","every_hour":"ժամը մեկ","daily":"օրը մեկ","weekly":"շաբաթական","every_month":"ամիսը մեկ","every_six_months":"վեց ամիսը մեկ"},"email_level":{"title":"Ուղարկել ինձ էլ, նամակ, երբ որևէ մեկը մեջբերում է ինձ, պատասխանում է իմ գրառմանը, նշում է իմ @օգտանունը կամ հրավիրում է ինձ թեմայի:","always":"միշտ","only_when_away":"միայն երբ հեռու եմ","never":"երբեք"},"email_messages_level":"Ուղարկել ինձ էլ. նամակ, երբ որևէ մեկը հաղորդագրություն է գրում ինձ:","include_tl0_in_digests":"Ներառել նոր օգտատերերի կողմից ավելացվածը ամփոփիչ էլ. նամակներում","email_in_reply_to":"Ներառել գրառումների պատասխանների քաղվածք էլ. նամակներում","other_settings":"Այլ","categories_settings":"Կատեգորիաներ","new_topic_duration":{"label":"Համարել թեմաները նոր, երբ","not_viewed":"Ես դեռևս դրանք չեմ դիտել","last_here":"ստեղծվել են իմ վերջին անգամ այնտեղ լինելուց հետո","after_1_day":"ստեղծվել են նախորդ օրվա ընթացքում","after_2_days":"ստեղծվել են վերջին 2 օրվա ընթացքում","after_1_week":"ստեղծվել են վերջին շաբաթվա ընթացքում","after_2_weeks":"ստեղծվել են վերջին 2 շաբաթվա ընթացքում"},"auto_track_topics":"Ավտոմատ կերպով հետևել իմ բացած թեմաներին","auto_track_options":{"never":"երբեք","immediately":"անմիջապես","after_30_seconds":"30 վայրկյան հետո","after_1_minute":"1 րոպե հետո","after_2_minutes":"2 րոպե հետո","after_3_minutes":"3 րոպե հետո","after_4_minutes":"4 րոպե հետո","after_5_minutes":"5 րոպե հետո","after_10_minutes":"10 րոպե հետո"},"notification_level_when_replying":"Երբ ես գրառում եմ կատարում թեմայում, նշանակել այդ թեման որպես","invited":{"search":"փնտրել հրավերներ...","title":"Հրավերներ","user":"Հրավիրված Օգտատեր","none":"Հրավերներ չկան:","truncated":{"one":"Առաջին հրավերի ցուցադրում","other":"Ցույց են տրված առաջին {{count}} հրավերները:"},"redeemed":"Ընդունված Հրավերները","redeemed_tab":"Ընդունված","redeemed_tab_with_count":"Ընդունված ({{count}})","redeemed_at":"Ընդունվել է","pending":"Սպասող Հրավերներ","pending_tab":"Սպասող","pending_tab_with_count":"Սպասող ({{count}})","topics_entered":"Դիտված Թեմաները","posts_read_count":"Կարդացած Գրառում","expired":"Այս հրավերի ժամկետն անցել է:","rescind":"Հեռացնել","rescinded":"Հրավերը հեռացված է","rescind_all":"Հեռացնել բոլոր Ժամկետանց Հրավերները","rescinded_all":"Բոլոր Ժամկետանց Հրավերները հեռացված են!","rescind_all_confirm":"Դուք համոզվա՞ծ եք, որ ցանկանում եք հեռացնել բոլոր ժամկետանց հրավերները:","reinvite":"Հրավերը կրկին ուղարկել","reinvite_all":"Կրկին ուղարկել բոլոր հրավերները ","reinvite_all_confirm":"Դուք համոզվա՞ծ եք, որ ցանկանում եք կրկին ուղարկել բոլոր հրավերները:","reinvited":"Հրավերը կրկին է ուղարկված","reinvited_all":"Բոլոր հրավերները կրկին ուղարկված են!","time_read":"Կարդացած Ժամանակը","days_visited":"Այցելության Օր","account_age_days":"Հաշվի տարիքը օրերով","create":"Ուղարկել Հրավեր","generate_link":"Կրկնօրինակել Հրավերի Հղումը","link_generated":"Հրավերի հղումը հաջողությամբ գեներացված է!","valid_for":"Հրավերի հղումը վավեր է միայն հետևյալ էլ. հասցեի համար՝ %{email}","bulk_invite":{"none":"Դուք դեռևս ոչ ոքի չեք հրավիրել այստեղ: Ուղարկեք անհատական հրավերներ կամ հրավիրեք բազմաթիվ մարդկանց միանգամից՝ \u003ca href='https://meta.discourse.org/t/send-bulk-invites/16468'\u003eվերբեռնելով CSV ֆայլ\u003c/a\u003e:","text":"Զանգվածային Հրավեր ֆայլից","success":"Ֆայլը հաջողությամբ վերբեռնվել է, Դուք կստանաք ծանուցում հաղորդագրության միջոցով, երբ գործընթացն ավարտվի:","error":"Ներողություն, ֆայլը պետք է լինի CSV ձևաչափով:","confirmation_message":"Դուք պատրաստվում եք էլ. նամակով հրավերներ ուղարկել վերբեռնված ֆայլում բոլոր նշվածներին:"}},"password":{"title":"Գաղտնաբառ","too_short":"Ձեր գաղտնաբառը շատ կարճ է:","common":"Այդ գաղտնաբառը շատ է տարածված:","same_as_username":"Ձեր գաղտնաբառը համընկնում է Ձեր օգտանվան հետ:","same_as_email":"Ձեր գաղտնաբառը համընկնում է Ձեր էլ. հասցեի հետ:","ok":"Ձեր գաղտնաբառն ընդունված է:","instructions":"առնվազն %{count} սիմվոլ"},"summary":{"title":"Ամփոփում","stats":"Վիճակագրություն","time_read":"կարդացած ժամանակը","recent_time_read":"վերջին կարդալու ժամանակը","topic_count":{"one":"ստեղծված թեմա","other":"ստեղծված թեմա"},"post_count":{"one":"տրված","other":"ստեղծված գրառում"},"likes_given":{"one":"տրված","other":"տրված"},"likes_received":{"one":"ստացած","other":"ստացած"},"days_visited":{"one":"դիտված թեմաներ","other":"այցելության օր"},"topics_entered":{"one":"դիտված թեմա","other":"դիտված թեմաները"},"posts_read":{"one":"կարդացած հրապարակում","other":"կարդացած գրառում"},"bookmark_count":{"one":"նշում","other":"էջանշան"},"top_replies":"Թոփ Պատասխանները","no_replies":"Պատասխաններ դեռևս չկան:","more_replies":"Ավելի Շատ Պատասխաններ","top_topics":"Թոփ Թեմաներ","no_topics":"Թեմաներ դեռևս չկան:","more_topics":"Ավելի Շատ Թեմաներ","top_badges":"Թոփ Կրծքանշաններ","no_badges":"Կրծքանշաններ դեռևս չկան","more_badges":"Ավելի Շատ Կրծքանշաններ","top_links":"Թոփ Հղումներ","no_links":"Հղումներ դեռևս չկան:","most_liked_by":"Առավել Շատ Հավանել են","most_liked_users":"Առավել Շատ Հավանել է","most_replied_to_users":"Առավել Շատ Պատասխանել է","no_likes":"Հավանումներ դեռևս չկան:","top_categories":"Թոփ Կատեգորիաներ","topics":"Թեմաներ","replies":"Պատասխաններ"},"ip_address":{"title":"Վերջին IP Հասցեն"},"registration_ip_address":{"title":"Գրանցման IP Հասցեն"},"avatar":{"title":"Պրոֆիլի Նկար","header_title":"պրոֆիլ, հաղորդագրություններ, էջանշաններ և նախընտրություններ"},"title":{"title":"Վերնագիր","none":"(ոչ մի)"},"primary_group":{"title":"Հիմնական Խումբ","none":"(ոչ մի)"},"filters":{"all":"Բոլորը"},"stream":{"posted_by":"Հրապարակվել է՝","sent_by":"Ուղարկվել է՝","private_message":"հաղորդագրություն","the_topic":"թեման"}},"loading":"Բեռնվում է...","errors":{"prev_page":"բեռնման ընթացքում","reasons":{"network":"Ցանցային Սխալ","server":"Սերվերի Սխալ","forbidden":"Թույլտվությունը Մերժված է","unknown":"Սխալ","not_found":"Էջը Չի Գտնվել"},"desc":{"network":"Խնդրում ենք ստուգել Ձեր ինտերնետը:","network_fixed":"Կապը համացանցին վերականգնվեց:","server":"Սխալի կոդը՝ {{status}}","forbidden":"Ձեզ թույլատրված չէ դիտել դա:","not_found":"Վա՜յ, հավելվածը փորձել է բեռնել գոյություն չունեցող URL:","unknown":"Ինչ-որ բան այն չէ:"},"buttons":{"back":"Վերադառնալ","again":"Կրկին Փորձել","fixed":"Բեռնել էջը"}},"modal":{"close":"փակել"},"close":"Փակել","assets_changed_confirm":"Այս կայքը հենց նոր թարմացվել է: Թարմացնե՞լ էջը հիմա՝ ամենավերջին տարբերակն ստանալու համար:","logout":"Դուք դուրս եք գրվել:","refresh":"Թարմացնել","read_only_mode":{"enabled":"Այս կայքը «միայն կարդալու համար» ռեժիմում է: Խնդրում ենք շարունակել, սակայն պատասխանելը, հավանելը և այլ գործողությունները հիմա անջատված են:","login_disabled":"Մուտք գործելն անջատված է, քանի դեռ կայքը գտնվում է «միայն կարդալու համար» ռեժիմում:","logout_disabled":"Դուրս գրվելը անջատված է, երբ կայքը գտնվում է միայն կարդալու համար ռեժիմում:"},"learn_more":"իմանալ ավելին...","all_time":"ընդհանուրը","all_time_desc":"ստեղծված բոլոր թեմաները","year":"տարի","year_desc":"վերջին 365 օրվա ընթացքում ստեղծված թեմաները","month":"ամիս","month_desc":"վերջին 30 օրվա ընթացքում ստեղծված թեմաները","week":"շաբաթ","week_desc":"վերջին 7 օրվա ընթացքում ստեղծված թեմաները","day":"օր","first_post":"Առաջին գրառումը","mute":"Խլացնել","unmute":"Միացնել ","last_post":"Հրապարակված","time_read":"Կարդացված","time_read_recently":"%{time_read} վերջերս","time_read_tooltip":"%{time_read} կարդալու ընդհանուր ժամանակը","time_read_recently_tooltip":"%{time_read} կարդալու ընդհանուր ժամանակը (%{recent_time_read} վերջին 60 օրվա ընթացքում)","last_reply_lowercase":"վերջին պատասխանը","replies_lowercase":{"one":"պատասխան","other":"պատասխան"},"signup_cta":{"sign_up":"Գրանցվել","hide_session":"Հիշեցնել ինձ վաղը","hide_forever":"ոչ, շնորհակալություն","hidden_for_session":"Լավ, ես կհարցնեմ վաղը: Դուք միշտ կարող եք օգտագործել նաև 'Մուտք'-ը հաշիվ ստեղծելու համար:","intro":"Ողջույն! Կարծես թե Դուք վայելում եք քննարկումը, սակայն դեռևս հաշիվ չեք գրանցել:","value_prop":"Երբ Դուք ստեղծում եք հաշիվ, մենք հստակ հիշում ենք, թե Դուք ինչ եք կադացել, այսպիսով՝ Դուք միշտ վերադառնում եք ճիշտ այնտեղ, որտեղ կանգնել էիք: Դուք նաև ստանում եք ծանուցումներ այստեղ և էլ. փոստով, երբ որևէ մեկը պատասխանում է Ձեզ: Եվ Դուք կարող եք հավանել գրառումներ՝ կիսվելով սիրով: :heartpulse:"},"summary":{"enabled_description":"Դուք դիտում եք այս թեմայի ամփոփումը՝ համայնքի կողմից որոշված ամենահետաքրքիր գրառումները:","description":"Կա \u003cb\u003e{{replyCount}}\u003c/b\u003e պատասխան:","description_time":"Կա \u003cb\u003e{{replyCount}}\u003c/b\u003e պատասխան՝ մոտավորապես \u003cb\u003e{{readingTime}} րոպե\u003c/b\u003e կարդալու ժամանակով:","enable":"Ամփոփել Այս Թեման","disable":"Ցուցադրել Բոլոր Գրառումները"},"deleted_filter":{"enabled_description":"Այս թեման պարունակում է հեռացված գրառումներ, որոնք թաքցվել են:","disabled_description":"Այս թեմայի հեռացված գրառումները ցուցադրվում են:","enable":"Թաքցնել Հեռացված Գրառումները","disable":"Ցուցադրել Հեռացված Գրառումները"},"private_message_info":{"title":"Հաղորդագրություն","invite":"Հրավիրել այլ Մարդկանց ...","edit":"Ավելացնել կամ Հեռացնել ...","leave_message":"Դուք իսկապե՞ս ցանկանում եք թողնել այս հաղորդագրությունը:","remove_allowed_user":"Դուք իսկապե՞ս ցանկանում եք հեռացնել {{name}}-ը այս հաղորդագրությունից:","remove_allowed_group":"Դուք իսկապե՞ս ցանկանում եք հեռացնել {{name}}-ը այս հաղորդագրությունից:"},"email":"Էլ. հասցե","username":"Օգտանուն","last_seen":"Ակտիվ էր","created":"Ստեղծվել է","created_lowercase":"ստեղծվել է","trust_level":"Վստահության Մակարդակ","search_hint":"օգտանուն, էլ. հասցե կամ IP հասցե","create_account":{"title":"Ստեղծել Նոր Հաշիվ","failed":"Ինչ-որ սխալ է տեղի ունեցել, հնարավոր է՝ այս էլ. հասցեն արդեն գրանցված է, փորձեք կատարել գաղտնաբառի վերականգնում:"},"forgot_password":{"title":"Գաղտնաբառի Վերականգնում","action":"Ես մոռացել եմ իմ գաղտնաբառը","invite":"Մուտքագրեք Ձեր օգտանունը կամ էլ. հասցեն, և մենք Ձեզ կուղարկենք գաղտնաբառի վերականգման էլ. նամակ:","reset":"Վերականգնել Գաղտնաբառը","complete_username":"Եթե որևէ հաշիվ համընկնում է \u003cb\u003e%{username}\u003c/b\u003e օգտանվանը, ապա Դուք շուտով կստանաք Ձեր գաղտնաբառի վերականգման հրահանգներով էլ. նամակ:","complete_email":"Եթե որևէ հաշիվ համընկնում է \u003cb\u003e%{email}\u003c/b\u003e էլ. հասցեին, ապա Դուք շուտով կստանաք Ձեր գաղտնաբառի վերականգման հրահանգներով էլ. նամակ:","complete_username_not_found":"Ոչ մի հաշիվ չի համընկնում \u003cb\u003e%{username}\u003c/b\u003e օգտանվանը","complete_email_not_found":"Ոչ մի հաշիվ չի համընկնում \u003cb\u003e%{email}\u003c/b\u003e էլ. հասցեին","help":"Էլ. նամակը չի՞ եկել: Համոզվեք՝ առաջին հերթին ստուգելով Սպամ թղթապանակը: \u003cp\u003eՀամոզված չեք, թե ո՞ր էլ. հասցեն եք օգտագործել. խնդրում ենք մուտքագրել այն այստեղ և մենք կստուգենք, թե արդյոք այն առկա է համակարգում:\u003c/p\u003e\u003cp\u003eԵթե Ձեր հաշվի էլ. հասցեն այլևս հասանելի չէ Ձեզ, խնդրում ենք կապ հաստատել \u003ca href='%{basePath}/about'\u003eմեր օգնության անձնակազմի հետ:\u003c/a\u003e\u003c/p\u003e","button_ok":"ՕԿ","button_help":"Օգնություն"},"email_login":{"link_label":"Ուղարկեք ինձ մուտքի հղում","button_label":"էլ. նամակով","complete_username":"Եթե \u003cb\u003e%{username}\u003c/b\u003e օգտանվանը համապատասխանող հաշիվ գոյություն ունի, ապա Դուք շուտով կստանաք էլ-նամակ մուտքի հղումով:","complete_email":"Եթե \u003cb\u003e%{email}\u003c/b\u003e էլ. հասցեին համապատասխանող հաշիվ գոյություն ունի, ապա Դուք շուտով կստանաք էլ. նամակ մուտքի հղումով:","complete_username_found":"Մենք գտել ենք \u003cb\u003e%{username}\u003c/b\u003e օգտանվանը համապատասխանող հաշիվ, Դուք շուտով կստանաք մուտքի հղումով էլ. նամակ:","complete_email_found":"Մենք գտել ենք հաշիվ, որը համընկնում է \u003cb\u003e%{email}\u003c/b\u003e էլ. հասցեի հետ, Դուք շուտով կստանաք էլ. նամակ մուտքի հղումով:","complete_username_not_found":"\u003cb\u003e%{username}\u003c/b\u003e օգտանվանը համապատասխանող հաշիվ չի գտնվել:","complete_email_not_found":"Ոչ մի հաշիվ չի համընկնում \u003cb\u003e%{email}\u003c/b\u003e էլ. հասցեին","confirm_title":"Շարունակել դեպի %{site_name}"},"login":{"title":"Մուտք","username":"Օգտատեր","password":"Գաղտնաբառ","second_factor_title":"Երկգործոն Վավերացում","second_factor_description":"Խնդրում ենք Ձեր հավելվածից մուտքագրել վավերացման կոդը՝","second_factor_backup_title":"Երկգործոն Պահուստային Պատճենում (Two Factor Backup)","second_factor_backup_description":"Խնդրում ենք մուտքագրել ձեր պահուստային կոդերից որևէ մեկը՝","email_placeholder":"էլ. հասցե կամ օգտանուն","caps_lock_warning":"Caps Lock-ը միացված է","error":"Անհայտ սխալ","rate_limit":"Խնդրում ենք սպասել՝ մինչ կրկին մուտք գործել փորձելը:","blank_username":"Խնդրում ենք մուտքագրել Ձեր էլ. հասցեն կամ օգտանունը:","blank_username_or_password":"Խնդրում ենք մուտքագրել Ձեր էլ. հասցեն կամ օգտանունը, և գաղտնաբառը:","reset_password":"Վերականգնել Գաղտնաբառը","logging_in":"Մուտք...","or":"Կամ","authenticating":"Վավերացվում է...","awaiting_activation":"Ձեր հաշիվն ակտիվացված չէ, օգտագործեք մոռացել եմ գաղտնաբառը հղումը՝ ակտիվացման մեկ այլ էլ. նամակ ստանալու համար:","awaiting_approval":"Ձեր հաշիվը դեռևս չի հաստատվել անձնակազմի կողմից: Երբ այն հաստատվի, Դուք կստանաք էլ. նամակ:","requires_invite":"Ներողություն, այս ֆորումին թույլտվությունը միայն հրավերով է:","not_activated":"Դուք դեռևս չեք կարող մուտք գործել: Մենք որոշ ժամանակ առաջ Ձեզ ուղարկել ենք ակտիվացման նամակ \u003cb\u003e{{sentTo}}\u003c/b\u003e էլ. հասցեին: Խնդրում ենք հետևել այդ նամակի հրահանգներին՝ Ձեր հաշիվը ակտիվացնելու համար:","not_allowed_from_ip_address":"Դուք չեք կարող մուտք գործել այդ IP հասցեից:","admin_not_allowed_from_ip_address":"Դուք չեք կարող մուտք գործել որպես ադմին այդ IP հասցեից:","resend_activation_email":"Սեղմեք այստեղ՝ ակտիվացման նամակը կրկին ուղարկելու համար: ","omniauth_disallow_totp":"Ձեր հաշվի վրա միացված է երկգործոն վավերացումը: Խնդրում ենք մուտք գործել Ձեր գաղտնաբառով: ","resend_title":"Կրկին Ուղարկել Ակտիվացման Նամակը","change_email":"Փոփոխել Էլ. Հասցեն","provide_new_email":"Տրամադրեք նոր էլ. հասցե, և մենք կրկին կուղարկենք հաստատման էլ. նամակը:","submit_new_email":"Փոխել Էլ. Հասցեն","sent_activation_email_again":"Մենք ուղարկել ենք ակտիվացման մեկ այլ նամակ \u003cb\u003e{{currentEmail}}\u003c/b\u003e էլ. հասցեին: Այն կհասնի մի քանի րոպեի ընթացքում; խնդրում ենք անպայման ստուգել նաև Ձեր Սպամ թղթապանակը:","sent_activation_email_again_generic":"Մենք ուղարկել ենք ակտիվացիայի մեկ այլ նամակ: Այն կժամանի մի քանի րոպեի ընթացքում. ստուգեք նաև սպամի արկղը:","to_continue":"Խնդրում ենք Մուտք Գործել","preferences":"Ձեր նախընտրությունները փոփոխելու համար անհրաժեշտ է մուտք գործել:","forgot":"Ես չեմ հիշում իմ հաշվի տվյալները:","not_approved":"Ձեր հաշիվը դեռևս չի հաստատվել: Դուք կստանաք ծանուցում էլ. նամակի միջոցով, երբ այն հաստատվի:","google_oauth2":{"name":"Google","title":"Google-ով"},"twitter":{"name":"Twitter","title":"Twitter-ով"},"instagram":{"name":"Instagram","title":"Instagram-ով"},"facebook":{"name":"Facebook","title":"Facebook-ով"},"github":{"name":"GitHub","title":"GitHub-ով"},"discord":{"name":"Discord"},"second_factor_toggle":{"totp":"Փոխարենը օգտագործել նույնականացման հավելվածը","backup_code":"Փոխարենը օգտագործել պահուստային կոդը"}},"invites":{"accept_title":"Հրավեր","welcome_to":"Բարի Գալուստ %{site_name}!","invited_by":"Ձեզ հրավիրել է՝","social_login_available":"Դուք նաև կկարողանաք մուտք գործել ցանկացած սոցիալական կայքով՝ օգտագործելով այդ էլ. հասցեն:","your_email":"Ձեր հաշվի էլ. հասցեն է՝ \u003cb\u003e%{email}\u003c/b\u003e:","accept_invite":"Ընդունել Հրավերը","success":"Ձեր հաշիվը ստեղծված է, և այժմ Դուք մուտք եք գործել:","name_label":"Անուն","password_label":"Առաջադրել Գաղտնաբառ","optional_description":"(ընտրովի)"},"password_reset":{"continue":"Շարունակել դեպի %{site_name}"},"emoji_set":{"apple_international":"Apple/International","google":"Google","twitter":"Twitter","win10":"Win10","google_classic":"Google Classic","facebook_messenger":"Facebook Messenger"},"category_page_style":{"categories_only":"Միայն Կատեգորիաները","categories_with_featured_topics":"Հանրահայտ Թեմաներով Կատեգորիաները","categories_and_latest_topics":"Կատեգորիաները և Վերջին Թեմաները","categories_and_top_topics":"Կատեգորիաները և Թոփ Թեմաները","categories_boxes":"Ենթակատեգորիաներ Պարունակող Արկղերը","categories_boxes_with_topics":"Հանրահայտ Թեմաներ Պարունակող Արկղերը"},"shortcut_modifier_key":{"shift":"Shift","ctrl":"Ctrl","alt":"Alt"},"conditional_loading_section":{"loading":"Բեռնվում է..."},"select_kit":{"default_header_text":"Ընտրել...","no_content":"Համընկնումներ չեն գտնվել","filter_placeholder":"Որոնում...","filter_placeholder_with_any":"Որոնել կամ ստեղծել...","create":"Ստեղծել '{{content}}'","max_content_reached":{"one":"Դուք կարող եք ընտրել միայն {{count}} տարր:","other":"Դուք կարող եք ընտրել միայն {{count}} տարր:"},"min_content_not_reached":{"one":"Ընտրեք առնվազն{{count}} տարր:","other":"Ընտրեք առնվազն {{count}} տարր:"}},"date_time_picker":{"from":"Ում կողմից","to":"Ում"},"emoji_picker":{"filter_placeholder":"Փնտրել էմոջի","smileys_\u0026_emotion":"Սմայլիկներ և Էմոցինաեր","people_\u0026_body":"Մարդիկ և Մարմնի մասեր","animals_\u0026_nature":"Կենդանիներ և Բնություն","food_\u0026_drink":"Սնունդ և Ըմպելիք","travel_\u0026_places":"ճամփորդություն և Վայրեր","activities":"Ակտիվություն","objects":"Օբյեկտներ","symbols":"Նշաններ","flags":"Դրոշներ","recent":"Վերջերս օգտագործված","default_tone":"Առանց շերտի գույնի","light_tone":"Շերտի բաց գույնով","medium_light_tone":"Շերտի միջինից բաց գույն","medium_tone":"Շերտի միջին գույն","medium_dark_tone":"Շերտի միջինից մուգ գույն","dark_tone":"Շերտի մուգ գույն","default":"Մասնավոր էմոջիներ"},"shared_drafts":{"title":"Կիսված Սևագրեր","notice":"Այս թեման տեսանելի է միայն նրանց, ովքեր կարող են տեսնել \u003cb\u003e{{category}}\u003c/b\u003e կատեգորիան:","destination_category":"Նպատակային Կատեգորիա","publish":"Հրատարակել կիսված սևագիրը","confirm_publish":"Դուք համոզվա՞ծ եք, որ ցանկանում եք հրատարակել այս սևագիրը:","publishing":"Թեման Հրատարակվում է..."},"composer":{"emoji":"Էմոջի :)","more_emoji":"ավելին...","options":"Տարբերակներ","whisper":"շշուկ","unlist":"չցուցակագրված","blockquote_text":"Մեջբերել բաժինը","add_warning":"Սա պաշտոնական զգուշացում է:","toggle_whisper":"Փոխանջատել Շշնջումը","toggle_unlisted":"Փոխանջատել Չցուցակագրվածները","posting_not_on_topic":"Ո՞ր թեմային եք Դուք ցանկանում պատասխանել:","saved_local_draft_tip":"պահված է տեղում","similar_topics":"Ձեր թեման նման է...","drafts_offline":"Օֆլայն սևագրեր","edit_conflict":"խմբագրել հակասությունը","group_mentioned_limit":"\u003cb\u003eՆախազգուշացում!\u003c/b\u003e Դուք հիշատակել եք \u003ca href='{{group_link}}'\u003e{{group}}\u003c/a\u003e խումբը, սակայն այս խումբն ունի ավելի շատ անդամ, քան ադմինիստրատորի կողմից կարգավորված հիշատակումների {{max}} սահմանային թիվը: Ոչ ոք ծանուցում չի ստանա:","group_mentioned":{"one":"Նշելով {{group}} ՝ Դուք ծանուցում եք \u003ca href='{{group_link}}'\u003e%{count} person\u003c/a\u003e . Դուք համոզվա՞ծ եք:","other":"Հիշատակելով {{group}}-ը՝ Դուք ծանուցում կուղարկեք \u003ca href='{{group_link}}'\u003e{{count}} օգտագիրոջ\u003c/a\u003e: Համոզվա՞ծ եք:"},"cannot_see_mention":{"category":"Դուք հիշատակել եք {{username}}-ին, բայց նա ծանուցում չի ստանա, քանի որ այս կատեգորիան նրան հասանելի չէ: Դուք պետք է ավելացնեք նրան որևէ խմբում, որը թուլտվություն ունի այս կատեգորիային:","private":"Դուք հիշատակել եք {{username}}-ին, բայց նա ծանուցում չի ստանա, քանի որ չի կարող տեսնել այս անձնական նամակը: Դուք պետք է հրավիրեք նրան այս անձնական նամակագրությանը:"},"duplicate_link":"Կարծես թե դեպի \u003cb\u003e{{domain}}\u003c/b\u003e Ձեր հղումն արդեն իսկ հրապարակված է թեմայում \u003cb\u003e@{{username}}\u003c/b\u003e-ի \u003ca href='{{post_url}}'\u003eպատասխանում {{ago}}\u003c/a\u003e: Դուք համոզվա՞ծ եք, որ ցանկանում եք այն կրկին հրապարակել:","error":{"title_missing":"Վերնագիրը պարտադիր է:","title_too_short":"Վերնագիրը պետք է լինի առնվազն {{min}} սիմվոլ:","title_too_long":"Վերնագիրը չպետք է գերազանցի {{max}} սիմվոլը:","post_length":"Գրառումը պետք է լինի առնվազն {{min}} սիմվոլ:","try_like":"Դուք փորձե՞լ եք {{heart}} կոճակը:","category_missing":"Դուք պետք է ընտրեք կատեգորիա:","tags_missing":"Դուք պետք է ընտրեք առնվազն{{count}} թեգ:"},"save_edit":"Պահել Խմբագրումը","overwrite_edit":"Վերասահմանել Խմբագրումը","reply_original":"Պատասխանել Սկզբնական Թեմային","reply_here":"Պատասխանել Այստեղ","reply":"Պատասխանել","cancel":"Չեղարկել","create_topic":"Ստեղծել Թեմա","create_pm":"Նոր Հաղորդագրություն","create_whisper":"Շշնջալ","create_shared_draft":"Ստեղծել Կիսված Սևագիր","edit_shared_draft":"Խմբագրել Կիսված Սևագիրը","title":"Կամ սեղմեք Ctrl+Enter","users_placeholder":"Ավելացնել օգտատեր","title_placeholder":"Համառոտ մեկ նախադասությամբ ներկայացրեք թե ինչի՞ մասին է քննարկումը:","title_or_link_placeholder":"Գրեք վերնագիրը կամ տեղադրեք հղումն այստեղ","edit_reason_placeholder":"Ո՞րն է խմբագրման պատճառը:","topic_featured_link_placeholder":"Մուտքագրել վերնագրի հետ ցուցադրվող հղում","remove_featured_link":"Հեռացնել հղումը թեմայից:","reply_placeholder":"Գրեք այստեղ: Օգտագործեք Markdown, BBCode, կամ HTML ֆորմատավորման համար: Քաշեք կամ տեղադրեք նկարներ:","reply_placeholder_no_images":"Գրեք այստեղ: Օգտագործեք Markdown, BBCode, կամ HTML ֆորմատավորման համար:","view_new_post":"Դիտել Ձեր նոր գրառումը:","saving":"Պահպանվում է","saved":"Պահված է!","uploading":"Վերբեռնվում է...","show_preview":"ցուցադրել նախադիտումը \u0026raquo;","hide_preview":"\u0026laquo; թաքցնել նախադիտումը","quote_post_title":"Մեջբերել ամբողջ գրառումը","bold_label":"B","bold_title":"Թավ","bold_text":"թավ տեքստ","italic_label":"I","italic_title":"Շեղ","italic_text":"շեղ տեքստ","link_title":"Հիպերհղում","link_description":"մուտքագրեք հղման նկարագրությունն այստեղ","link_dialog_title":"Տեղադրել Հիպերհղումը","link_optional_text":"ընտրովի վերնագիր","quote_title":"Մեջբերել","quote_text":"Մեջբերել բաժինը","code_title":"Ձևաչափված տեքստ","code_text":"Անջատել ձևաչափված տեքստը 4 բացատով","paste_code_text":"գրեք կամ տեղադրեք կոդն այստեղ","upload_title":"Վերբեռնել","upload_description":"գրեք վերբեռնման նկարագրությունն այստեղ","olist_title":"Համարակալված Ցուցակ","ulist_title":"Կետանշված Ցուցակ","list_item":"Ցանկի տարր","toggle_direction":"Փոխանջատել Ուղղությունը","help":"Markdown-ի խմբագրման օգնություն","collapse":"փակել կոմպոզերի կառավարման հարթակը","open":"բացել կոմպոզերի կառավարման հարթակը","abandon":"փակել կոմպոզերը և չեղարկել սևագիրը","enter_fullscreen":"մուտք գործել ամբողջական էկրանով կոմպոզեր","exit_fullscreen":"դուրս գալ ամբողջական էկրանով կոմպոզերից","modal_ok":"ՕԿ","modal_cancel":"Չեղարկել","cant_send_pm":"Ներողություն, Դուք չեք կարող ուղարկել հաղորդագրություն %{username}-ին:","yourself_confirm":{"title":"Մոռացե՞լ եք ավելացնել ստացողներին:","body":"Այս պահին հաղորդագրությունն ուղարկվում է միայն Ձեզ!"},"admin_options_title":"Անձնակազմի ընտրովի կարգավորումները այս թեմայի համար","composer_actions":{"reply":"Պատասխանել","draft":"Սևագրել","edit":"Խմբագրել","reply_to_post":{"label":"Պատասխանել %{postNumber} գրառմանը %{postUsername}-ի կողմից","desc":"Պատասխանել որոշակի գրառման"},"reply_as_new_topic":{"label":"Պատասխանել որպես կապված թեմա","desc":"Ստեղծել այս թեմային հղված նոր թեմա"},"reply_as_private_message":{"label":"Նոր հաղորդագրություն","desc":"Գրել նոր անձնական նամակ"},"reply_to_topic":{"label":"Պատասխանել թեմային","desc":"Պատասխանել թեմային, այլ ոչ թե որոշակի գրառման"},"toggle_whisper":{"label":"Փոխանջատել շշնջումը","desc":"Շշուկները տեսանելի են միայն անձնակազմին"},"create_topic":{"label":"Նոր Թեմա"},"shared_draft":{"label":"Ստեղծել Կիսված Սևագիր","desc":"Սևագրեք թեմա, որը տեսանելի կլինի միայն անձնակազմին"},"toggle_topic_bump":{"label":"Փոխանջատել թեմայի բարձրացումը ","desc":"Պատասխանել՝ առանց պատասխանի վերջին ամսաթիվը փոխելու"}},"details_title":"Ամփոփումը","details_text":"Այս տեքստը կթաքցվի"},"notifications":{"tooltip":{"regular":{"one":"%{count} չդիտված ծանուցում","other":"{{count}} չդիտված ծանուցում"},"message":{"one":"%{count} չկարդացած հաղորդագրություն","other":"{{count}} չկարդացած հաղորդագրություն"}},"title":"@անունի հիշատակումների, Ձեր գրառումների և թեմաների պատասխանների, հաղորդագրությունների և այլնի մասին ծանուցումներ ","none":"Սյս պահին հնարավոր չէ բեռնել ծանուցումները","empty":"Ծանուցումներ չեն գտնվել:","mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","group_mentioned":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","quoted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","bookmark_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","replied":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","posted":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","edited":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","liked_2":"\u003cspan\u003e{{username}}, {{username2}}\u003c/span\u003e {{description}}","liked_many":{"one":"\u003cspan\u003e{{username}}, {{username2}} and %{count} other\u003c/span\u003e {{description}}","other":"\u003cspan\u003e{{username}}, {{username2}} և ևս {{count}}-ը\u003c/span\u003e {{description}}"},"liked_consolidated_description":{"one":"հավանել է Ձեր {{count}} գրառում","other":"հավանել է Ձեր {{count}} գրառում"},"liked_consolidated":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","private_message":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_private_message":"\u003cp\u003e\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invited_to_topic":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","invitee_accepted":"\u003cspan\u003e{{username}}\u003c/span\u003e-ը ընդունել է Ձեր հրավերը","moved_post":"\u003cspan\u003e{{username}}\u003c/span\u003e-ը տեղափոխել է {{description}}-ը","linked":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","granted_badge":"Վասատկել է '{{description}}'","topic_reminder":"\u003cspan\u003e{{username}}\u003c/span\u003e {{description}}","watching_first_post":"\u003cspan\u003eՆոր Թեմա\u003c/span\u003e {{description}}","group_message_summary":{"one":"{{count}} հաղորդագրություն Ձեր {{group_name}} մուտքային արկղում","other":"{{count}} հաղորդագրություն Ձեր {{group_name}}-ի մուտքային արկղում"},"popup":{"mentioned":"{{username}}-ը հիշատակել է Ձեզ այստեղ՝ \"{{topic}}\" - {{site_title}}","group_mentioned":"{{username}}-ը հիշատակել է Ձեզ այստեղ՝ \"{{topic}}\" - {{site_title}}","quoted":"{{username}}-ը մեջբերել է Ձեզ այստեղ՝ \"{{topic}}\" - {{site_title}}","replied":"{{username}}-ը պատասխանել է Ձեզ այստեղ՝ \"{{topic}}\" - {{site_title}}","posted":"{{username}}-ը գրառում է կատարել այստեղ՝ \"{{topic}}\" - {{site_title}}","private_message":"{{username}}-ը ուղարկել է Ձեզ անձնական հաղորդագրություն այստեղ՝ \"{{topic}}\" - {{site_title}}","linked":"{{username}}-ը \"{{topic}}\" - {{site_title}}\"-ից հղում է կատարել Ձեր գրառմանը:","watching_first_post":"{{username}} -ը ստեղծել է նոր թեմա՝ \"{{topic}}\" - {{site_title}}","confirm_title":"Ծանուցումները միացված են. %{site_title}","confirm_body":"Հաջողվեց! Ծանուցումները միացված են:"},"titles":{"watching_first_post":"նոր թեմա","post_approved":"գրառումը հաստատված է"}},"upload_selector":{"title":"Ավելացնել նկար","title_with_attachments":"Ավելացնել նկար կամ ֆայլ","from_my_computer":"Իմ սարքից","from_the_web":"Համացանցից","remote_tip":"նկարի հղումը","remote_tip_with_attachments":"նկարի կամ ֆայլի հղում՝ {{authorized_extensions}}","local_tip":"ընտրեք նկարներ Ձեր սարքից","local_tip_with_attachments":"ընտրեք նկարներ կամ ֆայլեր Ձեր սարքից՝ {{authorized_extensions}}","hint":"(վերբեռնելու համար կարող եք նաև քաշել և գցել խմբագրիչի մեջ)","hint_for_supported_browsers":"Դուք կարող եք նաև քաշել և գցել կամ տեղադրել նկարները խմբագրիչի մեջ","uploading":"Վերբեռնվում է","select_file":"Ընտրել Ֆայլ","default_image_alt_text":"նկար"},"search":{"sort_by":"Դասավորել ըստ","relevance":"Համապատասխանության","latest_post":"Վերջին Գրառումը","latest_topic":"Վերջին Թեմայի","most_viewed":"Ամենաշատ Դիտված","most_liked":"Ամենաշատ Հավանած","select_all":"Ընտրել Բոլորը","clear_all":"Մաքրել Բոլորը","too_short":"Ձեր որոնման տեքստը շատ կարճ է:","result_count":{"one":"\u003cspan\u003e%{count} result for\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e","other":"\u003cspan\u003e{{count}}{{plus}} արդյունք\u003c/span\u003e\u003cspan class='term'\u003e{{term}}\u003c/span\u003e-ի համար"},"title":"որոնել թեմաներ, գրառումներ, օգտատերեր կամ կատեգորիաներ","full_page_title":"որոնել թեմաներ կամ գրառումներ","no_results":"Արդյունքներ չեն գտնվել:","no_more_results":"Արդյունքներ այլևս չեն գտնվել:","searching":"Փնտրվում է...","post_format":"#{{post_number}} {{username}}-ի կողմից","results_page":"Որոնել արդյունքները '{{term}}'-ի համար","more_results":"Գտնվել են բազմաթիվ արդյունքներ: Խնդրում ենք հստակեցնել Ձեր որոնման չափանիշները:","cant_find":"Չե՞ք կարողանում գտնել այն, ինչ փնտրում էիք:","start_new_topic":"Միգուցե՞ սկսեք նոր թեմա:","or_search_google":"Կամ փորձեք որոնել Google-ում:","search_google":"Փորձեք որոնել Google-ում:","search_google_button":"Google","search_google_title":"Որոնել այս կայքում","context":{"user":"Որոնել @{{username}}-ի գրառումները","category":"Որոնել #{{category}} կատեգորիայում","topic":"Որոնել այս թեմայում","private_messages":"Որոնել հաղորդագրություններում"},"advanced":{"title":"Ընդլայնված Որոնում","posted_by":{"label":"Հրապարակել է՝"},"in_category":{"label":"Դասակարգված"},"in_group":{"label":"Խմբում"},"with_badge":{"label":"Կրծքանշանով"},"with_tags":{"label":"Թեգերով"},"filters":{"label":"Վերադարձնել միայն թեմաներ/գրառումներ...","title":"Միայն վերնագրի համընկնումով","likes":"Ես հավանել եմ","posted":"Ես գրառում եմ կատարել","watching":"Ես դիտում եմ","tracking":"Ես հետևում եմ","private":"Իմ հաղորդագրություններում","bookmarks":"Ես էջանշել եմ","first":"ամենաառաջին գրառումներն են ","pinned":"ամրակցված են","unpinned":"ամրակցված չեն","seen":"Ես կարդացել եմ","unseen":"Ես չեմ կարդացել","wiki":"wiki են","images":"ներառում են նկար(ներ)","all_tags":"Բոլոր վերոնշյալ թեգերը"},"statuses":{"label":"Որտեղ թեմաները","open":"բաց են","closed":"փակ են","archived":"արխիվացված են","noreplies":"պատասխաններ չունեն","single_user":"պարունակում են մեկ օգտատեր"},"post":{"count":{"label":"Գրառումների Նվազագույն Քանակը"},"time":{"label":"Հրապարակվել է","before":"մինչև","after":"հետո"}}}},"hamburger_menu":"գնալ այլ թեմաների ցանկ կամ կատեգորիա","new_item":"նոր","go_back":"ետ գնալ","not_logged_in_user":"օգտատիրոջ էջը՝ ընթացիկ ակտիվության և նախընտրությունների ամփոփումով","current_user":"գնալ իմ էջը","topics":{"new_messages_marker":"վերջին այցելությունը","bulk":{"select_all":"Ընտրել Բոլորը","clear_all":"Ջնջել Բոլորը","unlist_topics":"Թեմաները Ցանկից Հանել","relist_topics":"Վերացանկավորել Թեմաները","reset_read":"Զրոյացնել Կարդացածները (Reset Read)","delete":"Ջնջել Թեմաները","dismiss":"Չեղարկել","dismiss_read":"Չեղարկել բոլոր չկարդացածները","dismiss_button":"Չեղարկել...","dismiss_tooltip":"Չեղարկել միայն նոր գրառումները կամ դադարել հետևել թեմաներին","also_dismiss_topics":"Դադարել հետևել այս թեմաներին, որ այլևս երբեք չցուցադրվեն ինձ համար որպես չկարդացած","dismiss_new":"Չեղարկել Նորերը","toggle":"փոխանջատել թեմաների զանգվածային ընտրությունը","actions":"Զանգվածային Գործողությունները","change_category":"Ավելացնել Կատեգորիա","close_topics":"Փակել Թեմաները","archive_topics":"Արխիվացնել Թեմաները","notification_level":"Ծանուցումներ","choose_new_category":"Ընտրել նոր կատեգորիա թեմաների համար՝","selected":{"one":"Դուք ընտրել եք \u003cb\u003e%{count}\u003c/b\u003e թեմա:","other":"Դուք ընտրել եք \u003cb\u003e{{count}}\u003c/b\u003e թեմա:"},"change_tags":"Փոխարինել Թեգերը","append_tags":"Ավելացնել Թեգեր","choose_new_tags":"Ընտրել նոր թեգեր այս թեմաների համար՝","choose_append_tags":"Ընտրել նոր թեգեր այս թեմաներին ավելացնելու համար՝","changed_tags":"Այդ թեմաների թեգերը փոփոխվել են:"},"none":{"unread":"Դուք չունեք չկարդացած թեմաներ:","new":"Դուք չունեք նոր թեմաներ:","read":"Դուք դեռևս չեք կարդացել ոչ մի թեմա:","posted":"Դուք դեռևս գրառում չեք կատարել ոչ մի թեմայում:","latest":"Վերջերս կատարված հրապարակումներ չկան: Տխուր է:","bookmarks":"Դուք դեռևս չունեք էջանշված թեմաներ:","category":" {{category}}-ում թեմաներ չկան:","top":"Թոփ թեմաներ չկան:","educate":{"new":"\u003cp\u003eՁեր նոր թեմաները ցույց կտրվեն այստեղ:\u003c/p\u003e\u003cp\u003eՍկզբում թեմաները համարվում են նոր և ցույց է տրվում \u003cspan class=\"badge new-topic badge-notification\" style=\"vertical-align:middle;line-height:inherit;\"\u003eնոր\u003c/span\u003e ցուցիչը, եթե նրանք ստեղծվել են վերջին 2 օրվա ընթացում:\u003c/p\u003e\u003cp\u003eՍա փոփոխելու համար բացեք Ձեր \u003ca href=\"%{userPrefsUrl}\"\u003eնախընտրությունները\u003c/a\u003e:\u003c/p\u003e","unread":"\u003cp\u003eՁեր չկարդացած թեմաները ցույց կտրվեն այստեղ:\u003c/p\u003e\u003cp\u003eՍկզբում, թեմաները համարվում են չկարդացած և ցույց է տրվում չկարդացածների \u003cspan class=\"badge new-posts badge-notification\"\u003e1\u003c/span\u003e ցուցիչ, եթե Դուք՝\u003c/p\u003e\u003cul\u003e\u003cli\u003eՍտեղծել եք թեման\u003c/li\u003e\u003cli\u003eՊատասխանել եք թեմային\u003c/li\u003e\u003cli\u003eկարդացել եք թեման ավելի քան 4 րոպե\u003c/li\u003e\u003c/ul\u003e\u003cp\u003eԿամ եթե Դուք բացահայտ կերպով թեմայի ծանուցումների կառավարման հարթակից ընտրել եք Դիտում Եմ կամ Հետևում Եմ:\u003c/p\u003e\u003cp\u003eՍա փոփոխելու համար բացեք Ձեր\u003ca href=\"%{userPrefsUrl}\"\u003eնախընտրությունները\u003c/a\u003e:\u003c/p\u003e"}},"bottom":{"latest":"Վերջին թեմաներ այլևս չկան:","posted":"Հրապարակված թեմաներ այլևս չկան:","read":"Կարդացած թեմաներ այլևս չկան:","new":"Նոր թեմաներ այլևս չկան:","unread":"Չկարդացած թեմաներ այլևս չկան:","category":"{{category}}-ում թեմաներ այլևս չկան:","top":"Թոփ թեմաներ այլևս չկան:","bookmarks":"Էջանշված թեմաներ այլևս չկան:"}},"topic":{"filter_to":{"one":"%{count} հրապարակում թեմայում","other":"{{count}} գրառում թեմայում"},"create":"Նոր Թեմա","create_long":"Ստեղծել Նոր Թեմա","open_draft":"Բացել Սևագիրը","private_message":"Սկսել հաղորդագրություն","archive_message":{"help":"Տեղափոխել հաղորդագրությունը Ձեր արխիվ","title":"Արխիվ"},"move_to_inbox":{"title":"Տեղափոխել Մուտքային արկղ","help":"Տեղափոխել հաղորդագրությունը ետ դեպի Մուտքային արկղ"},"edit_message":{"help":"Խմբագրել հաղորդագրության առաջին գրառումը","title":"Խմբագրել Հաղորդագրությունը"},"list":"Թեմաներ","new":"նոր թեմա","unread":"չկարդացած","new_topics":{"one":"%{count} նոր թեմա","other":"{{count}} նոր թեմա"},"unread_topics":{"one":"%{count} չկարդացած թեմա","other":"{{count}} չկարդացած թեմա"},"title":"Թեմա","invalid_access":{"title":"Թեման անձնական է","description":"Ներողություն, այդ թեման Ձեզ հասանելի չէ!","login_required":"Դուք պետք է մուտք գործեք՝ այդ թեման տեսնելու համար:"},"server_error":{"title":"Թեմայի բեռնումը ձախողվեց","description":"Ներողություն, մենք չկարողացանք բեռնել այդ թեման, հնարավոր է՝ միացման խնդրի պատճառով: Խնդրում ենք կրկին փորձել: Եթե խնդիրը շարունակվում է, տեղեկացրեք մեզ:"},"not_found":{"title":"Թեման չի գտնվել","description":"Ներողություն, մենք չկարողացանք գտնել այդ թեման: Միգուցե՞ այն հեռացվել է մոդերատորի կողմից:"},"total_unread_posts":{"one":"Դուք ունեք %{count} չկարդացած հրապարակում այս թեմայում","other":"Այս թեմայում Դուք ունեք {{count}} չկարդացած գրառում"},"unread_posts":{"one":"Դուք ունեք %{count} չկարդացած հին հրապարակում այս թեմայում","other":"Այս թեմայում Դուք ունեք {{count}} հին չկարդացած գրառում"},"new_posts":{"one":"Այս թեմայում կա %{count} նոր հրապարակում՝ Ձեր վերջին կարդալուց հետո:","other":"Ձեր վերջին կարդալուց հետո այս թեմայում կա {{count}} նոր գրառում"},"likes":{"one":"Այս թեմայում կա %{count} հավանում:","other":"Այս թեմայում կա {{count}} հավանում"},"back_to_list":"Վերադառնալ Թեմաների Ցանկին","options":"Թեմաների Տարբերակները","show_links":"ցուցադրել այս թեմայի հղումները","toggle_information":"փոխանջատել թեմայի մանրամասները","read_more_in_category":"Ցանկանո՞ւմ եք կարդալ ավելին: Դիտեք այլ թեմաներ՝ {{catLink}}-ում կամ {{latestLink}}.","read_more":"Ցանկանո՞ւմ եք կարդալ ավելին: {{catLink}} կամ {{latestLink}}.","browse_all_categories":"Դիտել բոլոր կատեգորիաները","view_latest_topics":"դիտեք վերջին թեմաները","suggest_create_topic":"Միգուցե՞ չստեղծել նոր թեմա","jump_reply_up":"ցատկել դեպի ավելի վաղ պատասխան","jump_reply_down":"ցատկել դեպի ավելի հին պատասխան","deleted":"Թեման ջնջվել է","topic_status_update":{"title":"Թեմայի Ժամաչափիչ","save":"Ժամաչափիչ Դնել","num_of_hours":"Ժամերի քանակը.","remove":"Հեռացնել Ժամաչափիչը","publish_to":"Հրատարակել.","when":"Երբ.","public_timer_types":"Թեմաների Ժամաչափիչներ","private_timer_types":"Օգտատիրոջ Թեմայի Ժամաչափիչներ","time_frame_required":"Խնդրում ենք ընտրել ժամանակահատված"},"auto_update_input":{"none":"Ընտրել ժամանակահատված","later_today":"Այսօր, մի փոքր ուշ","tomorrow":"Վաղը","later_this_week":"Այս շաբաթ, մի փոքր ավելի ուշ","this_weekend":"Այս շաբաթ-կիրակի","next_week":"Հաջորդ շաբաթ","two_weeks":"Երկու Շաբաթ","next_month":"Հաջորդ ամիս","three_months":"Երեք Ամիս","six_months":"Վեց Ամիս","one_year":"Մեկ Տարի","forever":"Ընդմիշտ","pick_date_and_time":"Ընտրել ամսաթիվ և ժամ","set_based_on_last_post":"Փակել՝ կախված վերջին գրառումից"},"publish_to_category":{"title":"Պլանավորել Հրատարակումը"},"temp_open":{"title":"Ժամանակավորապես Բացել"},"auto_reopen":{"title":"Ավտոմատ բացել Թեման "},"temp_close":{"title":"Ժամանակավորապես Փակել"},"auto_close":{"title":"Ավտոմատ փակել Թեման","label":"Ավտոմատ փակել թեմայի ժամերը՝ ","error":"Խնդրում ենք մուտքագրել վավեր արժեք:","based_on_last_post":"Չփակել, մինչև թեմայի վերջին գրառումը չունենա այսքան վաղեմություն:"},"auto_delete":{"title":"Ավտոմատ Ջնջել Թեման"},"auto_bump":{"title":"Ավտոմատ Բարձրացնել Թեման"},"reminder":{"title":"Հիշեցնել Ինձ"},"status_update_notice":{"auto_open":"Այս թեման ավտոմատ կբացվի %{timeLeft}:","auto_close":"Այս թեման ավտոմատ կփակվի %{timeLeft}:","auto_publish_to_category":"Այս թեման կհրատարակվի \u003ca href=%{categoryUrl}\u003e#%{categoryName}\u003c/a\u003e-ում %{timeLeft}:","auto_close_based_on_last_post":"Այս թեման կփակվի վերջին պատասխանից %{duration} հետո:","auto_delete":"Այս թեման ավտոմատ կերպով կջնջվի %{timeLeft}:","auto_bump":"Այս թեման ավտոմատ կբարձրացվի %{timeLeft}:","auto_reminder":"Ձեզ կհիշեցվի այս թեմայի մասին %{timeLeft}:"},"auto_close_title":"Ավտոմատ Փակման Կարգավորումները","auto_close_immediate":{"one":"Այս թեմայի վերջին հրապարակումը արդեն %{count} ժամ վաղեմութոյւն ունի, հետևաբար՝ թեման անմիջապես կփակվի:","other":"Այս թեմայի վերջին գրառումն արդեն %{count} ժամվա վաղեմություն ունի, հետևաբար՝ թեման անմիջապես կփակվի:"},"timeline":{"back":"Վերադառնալ","back_description":"Վերադառնալ Ձեր վերջին չկարդացած գրառմանը","replies_short":"%{current} / %{total}"},"progress":{"title":"թեմայի ընթացքը","go_top":"վերև","go_bottom":"ներքև","go":"գնալ","jump_bottom":"ցատկել դեպի վերջին գրառում","jump_prompt":"ցատկել դեպի...","jump_prompt_of":"%{count} գրառումից","jump_bottom_with_number":"ցատկել դեպի %{post_number}գրառումը","jump_prompt_to_date":"դեպի ամսաթիվ","jump_prompt_or":"կամ","total":"ընդհանուր գրառումներ","current":"ընթացիկ գրառումը"},"notifications":{"title":"Փոխել, թե որքան հաճախ եք Դուք ծանուցում ստանում այս թեմայի մասին","reasons":{"mailing_list_mode":"Ձեզ մոտ միացված է փոստային ցուցակի ռեժիմը, ուստի էլ. փոստի միջոցով Դուք ծանուցում կստանաք այս թեմայի պատասխանների մասին:","3_10":"Դուք ծանուցումներ կստանաք, քանի որ դիտում եք այս թեմայի թեգի:","3_6":"Դուք ծանուցումներ կստանաք, քանի որ դիտում եք այս կատեգորիան:","3_5":"Դուք ծանուցումներ կստանաք, քանի որ ավտոմատ կերպով սկսել եք դիտել այս թեման:","3_2":"Դուք ծանուցումներ կստանաք, քանի որ դիտում եք այս թեման:","3_1":"Դուք ծանուցումներ կստանաք, քանի որ ստեղծել եք այս թեման:","3":"Դուք ծանուցումներ կստանաք, քանի որ դիտում եք այս թեման:","2_8":"Դուք կտեսնեք նոր պատասխանների քանակը, քանի որ հետևում եք այս կատեգորիային:","2_4":"Դուք կտեսնեք նոր պատասխանների քանակը, քանի որ հրապարակել եք պատասխան այս թեմայում:","2_2":"Դուք կտեսնեք նոր պատասխանների քանակը, քանի որ հետևում եք այս թեմային:","2":"Դուք կտեսնեք նոր պատասխանների քանակը, քանի որ Դուք \u003ca href=\"{{basePath}}/u/{{username}}/preferences\"\u003eկարդացել եք այս թեման\u003c/a\u003e:","1_2":"Դուք ծանուցում կստանաք, եթե որևէ մեկը հիշատակի Ձեր @անունը կամ պատասխանի Ձեզ:","1":"Դուք ծանուցում կստանաք, եթե որևէ մեկը հիշատակի Ձեր @անունը կամ պատասխանի Ձեզ:","0_7":"Դուք անտեսում եք այս կատեգորիայի բոլոր ծանուցումները:","0_2":"Դուք անտեսում եք այս թեմայի բոլոր ծանուցումները:","0":"Դուք անտեսում եք այս թեմայի բոլոր ծանուցումները:"},"watching_pm":{"title":"Դիտում Եմ","description":"Դուք ծանուցում կստանաք այս հաղորդագրության յուրաքանչյուր նոր պատասխանի մասին, և կցուցադրվի նոր պատասխանների քանակը:"},"watching":{"title":"Դիտում Եմ","description":"Դուք ծանուցում կստանաք այս թեմայի յուրաքանչյուր նոր պատասխանի մասին, և կցուցադրվի նոր պատասխանների քանակը:"},"tracking_pm":{"title":"Հետևում Եմ","description":"Այս հաղորդագրության համար կցուցադրվի նոր պատասխանների քանակը: Դուք ծանուցում կստանաք, եթե որևէ մեկը հիշատակի Ձեր @անունը կամ պատասխանի Ձեզ:"},"tracking":{"title":"Հետևում Եմ","description":"Այս թեմայի համար կցուցադրվի նոր պատասխանների քանակը: Դուք ծանուցում կստանաք, եթե որևէ մեկը հիշատակի Ձեր @անունը կամ պատասխանի Ձեզ:"},"regular":{"title":"Սովորական","description":"Դուք ծանուցում կստանաք, եթե որևէ մեկը հիշատակի Ձեր @անունը կամ պատասխանի Ձեզ:"},"regular_pm":{"title":"Սովորական","description":"Դուք ծանուցում կստանաք, եթե որևէ մեկը հիշատակի Ձեր @անունը կամ պատասխանի Ձեզ:"},"muted_pm":{"title":"Խլացված","description":"Դուք երբեք որևէ ծանուցում չեք ստանա այս հաղորդագրության վերաբերյալ:"},"muted":{"title":"Խլացված","description":"Դուք երբեք որևէ ծանուցում չեք ստանա այս թեմայի վերաբերյալ, և այն չի հայտնվի վերջիններում:"}},"actions":{"title":"Գործողություններ","recover":"Վերականգնել Թեման","delete":"Ջնջել Թեման","open":"Բացել Թեման","close":"Փակել Թեման","multi_select":"Ընտրել Գրառումներ...","timed_update":"Դնել Թեմայի Ժամաչափիչ","pin":"Ամրակցել Թեման...","unpin":"Ապակցել Թեման...","unarchive":"Ապարխիվացնել Թեման","archive":"Արխիվացնել Թեման","invisible":"Դարձնել Չցուցակագրված","visible":"Դարձնել Ցուցակագրված","reset_read":"Զրոյացնել Կարդացած Տվյալները","make_public":"Ստեղծել Հրապարակային Թեմա","make_private":"Ստեղծել Անձնական Նամակ","reset_bump_date":"Վերահաստատել Բարձրացման Ամսաթիվը"},"feature":{"pin":"Ամրակցել Թեման","unpin":"Ապակցել Թեման","pin_globally":"Ամրակցել Թեման Գլոբալ կերպով","make_banner":"Բաններ Թեմա","remove_banner":"Հեռացնել Բաններ Թեման"},"reply":{"title":"Պատասխանել","help":"այս թեմային պատասխան գրել"},"clear_pin":{"title":"Հեռացնել ամրակցումը","help":"Հեռացնել այս թեմայի ամրակցված կարգավիճակը, որպեսզի այն այլևս չհայտնվի Ձեր թեմաների ցանկի վերևում:"},"share":{"title":"Կիսվել","extended_title":"Կիսվել հղումով","help":"կիսվել այս թեմայի հղումով"},"print":{"title":"Տպել","help":"Բացել այս թեմայի տպման հարմար նախատեսված տարբերակը"},"flag_topic":{"title":"Դրոշակավորել","help":"թեմային ուշադրություն գրավել՝ գաղտնի կերպով դրոշակավորելով կամ ուղարկելով գաղտնի ծանուցում այդ մասին","success_message":"Դուք հաջողությամբ դրոշակավորեցիք այս թեման:"},"feature_topic":{"title":"Ամրացնել այս թեման","pin":"Այս թեման տեղադրել {{categoryLink}} կատեգորիայի վերևում մինչև","confirm_pin":"Դուք արդեն ունեք {{count}} ամրակցված թեմա: Չափից շատ ամրակցված թեմաները կարող են անհարմարություն պատճառել նոր և անանուն օգտատերերին: Դուք համոզվա՞ծ եք, որ ցանկանում եք ամրակցել ևս մեկ թեմա այս կատեգորիայում:","unpin":"Հանել այս թեման {{categoryLink}} կատեգորիայի վերևից:","unpin_until":"Հանել այս թեման{{categoryLink}} կատեգորիայի վերևից կամ սպասել մինչև \u003cstrong\u003e%{until}\u003c/strong\u003e:","pin_note":"Օգտատերերը կարող են ապակցել թեման անհատապես իրենց համար:","pin_validation":"Ամսաթիվը պարտադիր է այս թեման ամրակցելու համար:","not_pinned":"{{categoryLink}} կատեգորիայում ոչ մի թեմա ամրակցված չէ:","already_pinned":{"one":"Ներկայումս {{categoryLink}}կատեգորիայում ամրակցված Թեմաներ՝ \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Ներկայումս {{categoryLink}} կատեգորիայում ամրակցված թեմաները՝ \u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"pin_globally":"Այս թեման տեղադրել բոլոր թեմաների ցանկերի վերում, մինչև","confirm_pin_globally":"Դուք արդեն ունեք գլոբալ կերպով ամրակցված {{count}}թեմա: Չափից շատ ամրակցված թեմաները կարող են անհարմարություն պատճառել նոր և անանուն օգտատերերին: Դուք համոզվա՞ծ եք, որ ցանկանում եք գլոբալ կերպով ամրակցել ևս մեկ թեմա:","unpin_globally":"Հանել այս թեման բոլոր թեմաների ցանկերի վերևից","unpin_globally_until":"Հանել այս թեման բոլոր թեմաների ցանկերի վերևից կամ սպասել մինչև \u003cstrong\u003e%{until}\u003c/strong\u003e:","global_pin_note":"Օգտատերերը կարող են ապակցել թեման անհատապես իրենց համար:","not_pinned_globally":"Գլոբալ կերպով ամրակցված թեմաներ չկան:","already_pinned_globally":{"one":"Ներկայումս գլոբալ կերպով ամրակցված թեմաներ՝ \u003cstrong class='badge badge-notification unread'\u003e%{count}\u003c/strong\u003e","other":"Ներկայումս գլոբալ կերպով ամրակցված թեմաները՝\u003cstrong class='badge badge-notification unread'\u003e{{count}}\u003c/strong\u003e"},"make_banner":"Այս թեման դարձնել բաններ, որը հայտնվում է բոլոր էջերի վերևում:","remove_banner":"Հանել բանները, որը հայտնվում է բոլոր էջերի վերևում:","banner_note":"Օգտատերերը կարող են չեղարկել բանները՝ փակելով այն: Ցանկացած պահի միայն մեկ թեմա կարող է լինել որպես բաններ:","no_banner_exists":"Բաններ թեմա չկա:","banner_exists":"Այս պահին բաններ թեմա \u003cstrong class='badge badge-notification unread'\u003eկա\u003c/strong\u003e:"},"inviting":"Հրավիրվում է...","automatically_add_to_groups":"Այս հրավերը ներառում է նաև հետևյալ խմբերի թույլտվություն՝","invite_private":{"title":"Հրավիրել Հաղորդագրության","email_or_username":"Հրավիրվողի Էլ. հասցեն կամ Օգտանունը","email_or_username_placeholder":"էլ. հասցե կամ օգտանուն","action":"Հրավիրել","success":"Մենք հրավիրել ենք այդ օգտատիրոջը՝ մասնակցելու այս հաղորդագրությանը:","success_group":"Մենք հրավիրել ենք այդ խմբին՝ մասնակցելու այս հաղորդագրությանը:","error":"Այդ օգտատիրոջը հրավիրելիս տեղի է ունեցել սխալ, ներողություն:","group_name":"խմբի անունը"},"controls":"Թեմայի Կառավարման Հարթակ","invite_reply":{"title":"Հրավիրել","username_placeholder":"օգտանուն","action":"Ուղարկել Հրավեր","help":"Հրավիրել մյուսներին այս թեմային էլ. հասցեի կամ ծանուցումների միջոցով","to_forum":"Մենք կուղարկենք համառոտ էլ. նամակ, որը թույլ կտա Ձեր ընկերոջը անմիջապես միանալ՝ սեղմելով հղմանը, առանց մուտք գործելու անհրաժեշտության:","sso_enabled":"Մուտքագրեք այն անձի օգտանունը, ում ցանկանում եք հրավիրել այս թեմային:","to_topic_blank":"Մուտքագրեք այն անձի օգտանունը կամ էլ. հասցեն, ում ցանկանում եք հրավիրել այս թեմային:","to_topic_email":"Դուք մուտքագրել եք էլ. հասցե: Մենք կուղարկենք հրավեր, որը թույլ կտա Ձեր ընկերոջը անմիջապես պատասխանել այս թեմային:","to_topic_username":"Դուք մուտքագրել եք օգտանուն: Մենք կուղարկենք ծանուցում՝ այս թեմային հրավերի հղումով:","to_username":"Մուտքագրեք այն անձի օգտանունը, ում ցանկանում եք հրավիրել: Մենք կուղարկենք ծանուցում՝ այս թեմային հրավերի հղումով:","email_placeholder":"name@example.com","success_email":"Մենք ուղարկել ենք հրավերի էլ. նամակ \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e-ին: Մենք ծանուցում կուղարկենք Ձեզ, երբ հրավերն ընդունվի: Ստուգեք Ձեր էջի հրավերների ներդիրը՝ Ձեր հրավերներին հետևելու համար:","success_username":"Մենք հրավիրել ենք այդ օգտատիրոջը մասնակցելու այս թեմային:","error":"Ներողություն, մենք չկարողացանք հրավիրել այդ մարդուն: Միգուցե նա արդեն հրավիրվա՞ծ է: (Հրավերները սահմանափակ են)","success_existing_email":" \u003cb\u003e{{emailOrUsername}}\u003c/b\u003e էլ. հասցեով օգատեր արդեն գոյություն ունի: Մենք հրավիրել ենք նրան մասնակցելու այս թեմային:"},"login_reply":"Պատասխանելու համար Մուտք Գործեք","filters":{"n_posts":{"one":"%{count} հրապարակում","other":"{{count}} գրառում"},"cancel":"Հանել ֆիլտրը"},"move_to":{"title":"Տեղափոխել դեպի","action":"տեղափոխել դեպի","error":"Գրառումները տեղափոխելիս տեղի է ունեցել սխալ:"},"split_topic":{"title":"Տեղափոխվել դեպի Նոր Թեմա","action":"տեղափոխվել դեպի նոր թեմա","topic_name":"Նոր Թեմայի Վերնագիրը","radio_label":"Նոր Թեմա","error":"Գրառումները նոր թեմա տեղափոխելիս տեղի է ունեցել սխալ:","instructions":{"one":"Դուք պատրաստվում եք ստեղծել նոր թեմա և մուտքագրել Ձեր ընտրած հրապարակումով:","other":"Դուք պատրաստվում եք ստեղծել նոր թեմա և մուտքագրել Ձեր ընտրած \u003cb\u003e{{count}}\u003c/b\u003e գրառումը:"}},"merge_topic":{"title":"Տեղափոխել դեպի Գոյություն Ունեցող Թեմա","action":"տեղափոխել դեպի գոյություն ունեցող թեմա","error":"Գրառումներն այդ թեմա տեղափոխելիս տեղի է ունեցել սխալ:","radio_label":"Գոյություն Ունեցող Թեմա","instructions":{"one":"Խնդրում ենք ընտրել թեմա, ուր ցանկանում եք տեղափոխել այդ հրապարակումը: ","other":"Խնդրում ենք ընտրել թեմա, ուր ցանկանում եք տեղափոխել այդ \u003cb\u003e{{count}}\u003c/b\u003e գրառումը:"}},"move_to_new_message":{"title":"Տեղափոխել դեպի Նոր Հաղորդագրություն","action":"տեղափոխել դեպի նոր հաղորդագրություն","message_title":"Նոր Հաղորդագրության Վերնագիրը","radio_label":"Նոր Հաղորդագրություն","participants":"Մասնակիցներ","instructions":{"one":"Դուք պատրաստվում եք ստեղծել նոր հաղորդագրություն և մասսայականացնել այն Ձեր ընտրած գրառումով:","other":"Դուք պատրաստվում եք ստեղծել նոր հաղորդագրություն և լցնել այն Ձեր ընտրած \u003cb\u003e{{count}}\u003c/b\u003e գրառումով:"}},"move_to_existing_message":{"title":"Տեղափոխել դեպի Գոյություն Ունեցող Հաղորդագրություն","action":"տեղափոխել դեպի գոյություն ունեցող հաղորդագրություն","radio_label":"Գոյություն Ունեցող Հաղորդագրություն","participants":"Մասնակիցներ","instructions":{"one":"Խնդրում ենք ընտրել հաղորդագրությունը, ուր ցանկանում եք տեղափոխել այդ գրառումը:","other":"Խնդրում ենք ընտրել հաղորդագրությունը, ուր ցանկանում եք տեղափոխել այդ \u003cb\u003e{{count}}\u003c/b\u003e գրառումները:"}},"merge_posts":{"title":"Միավորել Ընտրված Գրառումները","action":"միավորել ընտրված գրառումները","error":"Ընտրված գրառումները միավորելիս տեղի է ունեցել սխալ:"},"change_owner":{"title":"Փոխել Սեփականատիրոջը","action":"փոխել սեփականությունը","error":"Գրառումների սեփականատիրոջը փոփոխելիս տեղի է ունեցել սխալ:","placeholder":"նոր սեփականատիրոջ օգտանունը","instructions":{"one":"Խնդրում ենք ընտրել նոր սեփականատեր \u003cb\u003e@{{old_user}}\u003c/b\u003e կողմից կատարված հրապարակման համար","other":"Խնդրում ենք ընտրել նոր սեփականատեր \u003cb\u003e@{{old_user}}\u003c/b\u003e-ի {{count}} գրառման համար:"}},"change_timestamp":{"title":"Փոփոխել Ժամանակակետը","action":"փոփոխել ժամանակակետը","invalid_timestamp":"Ժամանակակետը չի կարող լինել ապագայում:","error":"Թեմայի ժամանակակետը փոփոխելիս տեղի է ունեցել սխալ:","instructions":"Խնդրում ենք ընտրել թեմայի նոր ժամանակակետը: Թեմայի գրառումները կթարմացվեն՝ նույն ժամային տարբերությունն ունենալու համար:"},"multi_select":{"select":"ընտրել","selected":"ընտրված ({{count}})","select_post":{"label":"ընտրել","title":"Ընտրվածին ավելացնել գրառում"},"selected_post":{"label":"ընտրված","title":"Սեղմեք՝ գրառումն ընտրվածից հեռացնելու համար "},"select_replies":{"label":"ընտրել+պատասխաններ","title":"Ավելացնել գրառումը և դրա բոլոր պատասխանները ընտրվածին"},"select_below":{"label":"ընտրել+ներքև","title":"Ավելացնել գրառումը և դրանից հետո բոլորը ընտրվածին"},"delete":"ջնջել ընտրվածը","cancel":"չեղարկել ընտրվածը","select_all":"ընտրել բոլորը","deselect_all":"հետընտրել բոլորը","description":{"one":"Դուք ընտրել եք \u003cb\u003e%{count}\u003c/b\u003e հրապարակում:","other":"Դուք ընտրել եք \u003cb\u003e{{count}}\u003c/b\u003e գրառում:"}}},"post":{"quote_reply":"Մեջբերել","edit_reason":"Պատճառը՝ ","post_number":"գրառում {{number}}","wiki_last_edited_on":"wiki-ն վերջին անգամ խմբագրվել է","last_edited_on":"գրառումը վերջին անգամ խմբագրվել է","reply_as_new_topic":"Պատասխանել որպես հղված թեմա","reply_as_new_private_message":"Պատասխանել որպես հաղորդագրություն նույն ստացողներին","continue_discussion":"Շարունակելով {{postLink}} քննարկումը՝ ","follow_quote":"գնալ դեպի մեջբերված գրառումը","show_full":"Ցուցադրել Գրառումն Ամբողջությամբ","deleted_by_author":{"one":"(հեղինակի կողմից հեռացված հրապարակում, ավտոմատ կերպով կջնջվի %{count} ժամից, եթե դրոշակավորված չէ)","other":"(եթե հեղինակի կողմից հեռացված գրառումը չդրոշակավորվի, ապա ավտոմատ կերպով կջնջվի %{count} ժամից)"},"collapse":"կրճատել","expand_collapse":"ընդլայնել/կրճատել","locked":"անձնակազմի որևէ ներկայացուցիչ արգելափակել է այս գրառման խմբագրումը","gap":{"one":"դիտել %{count} թաքցրած պատասխան","other":"դիտել {{count}} թաքցրած պատասխանները"},"notice":{"new_user":"Առաջին անգամն է, որ {{user}} -ը գրառում է կատարել — եկեք ողջունենք նրան մեր համայնքում!","returning_user":"Բավական ժամանակ է անցել {{user}} -ին տեսնելուց հետո — նրա վերջին գրառումը եղել է {{time}}:"},"unread":"Գրառումը կարդացած չէ","has_replies":{"one":"{{count}} պատասխան","other":"{{count}} Պատասխան"},"has_likes_title":{"one":"%{count} անձ հավանել է այս հրապարակումը","other":"{{count}} մարդ հավանել է այս գրառումը"},"has_likes_title_only_you":"Դուք հավանել եք այս գրառումը","has_likes_title_you":{"one":"Դուք և %{count} այլ անձ հավանել եք այս հրապարակումը","other":"Դուք և {{count}} հոգի հավանել են այս գրառումը"},"errors":{"create":"Ներողություն, Ձեր գրառումը ստեղծելիս տեղի է ունեցել սխալ: Խնդրում ենք կրկին փորձել:","edit":"Ներողություն, Ձեր գրառումը խմբագրելիս տեղի է ունեցել սխալ: Խնդրում ենք կրկին փորձել:","upload":"Ներողություն, այդ ֆայլը վերբեռնելիս տեղի է ունեցել սխալ: Խնդրում ենք կրկին փորձել:","file_too_large":"Ներողություն, այդ ֆայլը շատ մեծ է (առավելագույն չափը {{max_size_kb}}ԿԲ է): Առաջարկվում ենք վերբեռնել Ձեր մեծ ֆայլը որևէ ամպային ծառայություն(cloud service) և կիսվել հղումով:","too_many_uploads":"Ներողություն, Դուք կարող եք վերբեռնել միաժամանակ միայն մեկ ֆայլ:","too_many_dragged_and_dropped_files":"Ներողություն, Դուք կարող եք վերբեռնել միաժամանակ միայն {{max}} ֆայլ:","upload_not_authorized":"Ներողություն, ֆայլը, որ Դուք փորձում եք վերբեռնել թուլատրելի չէ (թույլատրվում են միայն՝ {{authorized_extensions}}):","image_upload_not_allowed_for_new_user":"Ներողություն, նոր օգտատերերը չեն կարող վերբեռնել նկարներ:","attachment_upload_not_allowed_for_new_user":"Ներողություն, նոր օգտատերերը չեն կարող ֆայլեր կցել:","attachment_download_requires_login":"Ներողություն, Դուք պետք է մուտք գործեք՝ կցված ֆայլերը ներբեռնելու համար:"},"abandon_edit":{"no_value":"Ոչ, պահել"},"abandon":{"confirm":"Դուք համոզվա՞ծ եք, որ ցանկանում եք լքել Ձեր գրառումը:","no_value":"Ոչ, պահել","yes_value":"Այո, լքել"},"via_email":"այս գրառումը եկել է էլ. նամակով","via_auto_generated_email":"այս գրառումը եկել է ավտոմատ գեներացված էլ. նամակով","whisper":"այս գրառումը գաղտնի շշուկ է մոդերատորների համար","wiki":{"about":"այս գրառումը wiki է"},"archetypes":{"save":"Պահպանելու Տարբերակները"},"few_likes_left":"Շնորհակալ ենք տրված հավանումների համար: Այսօր Ձեզ մնացել է միայն մի քանի հավանում:","controls":{"reply":"պատասխանել այս գրառմանը","like":"հավանել այս գրառումը","has_liked":"Դուք հավանել եք այս գրառումը","undo_like":"Ետարկել հավանումը","edit":"խմբագրել այս գրառումը","edit_action":"Խմբագրել","edit_anonymous":"Ներողություն, Դուք պետք է մուտք գործեք՝ այս գրառումը խմբագրելու համար:","flag":"գրառմանը ուշադրություն գրավել՝ գաղտնի կերպով դրոշակավորելով կամ ուղարկելով գաղտնի ծանուցում այդ մասին","delete":"ջնջել այս գրառումը","undelete":"վերականգնել այս գրառումը","share":"կիսվել այս գրառման հղումով","more":"Ավելին","delete_replies":{"confirm":"Դուք ցանկանո՞ւմ եք ջնջել նաև այս գրառման պատասխանները:","direct_replies":{"one":"Այո, և %{count} ուղղակի պատասխան","other":"Այո, և {{count}} ուղղակի պատասխանները"},"all_replies":{"one":"Այո, և %{count} պատասխանը","other":"Այո, և բոլոր {{count}} պատասխանները"},"just_the_post":"Ոչ, միայն այս գրառումը"},"admin":"գրառման ադմինի գործողություններ","wiki":"Դարձնել Wiki","unwiki":"Հանել Wiki-ից","convert_to_moderator":"Ավելացնել Անձնակազմի Գույն","revert_to_regular":"Հեռացնել Անձնակազմի Գույնը","rebake":"Վերակառուցել HTML-ը","unhide":"Դարձնել Տեսանելի","change_owner":"Փոխել Սեփականատիրոջը","grant_badge":"Շնորհել Կրծքանշան","lock_post":"Արգելափակել Գրառումը","lock_post_description":"արգելել հրապարակողին խմբագրել այս գրառումը","unlock_post":"Արգելաբացել Գրառումը","unlock_post_description":"թույլ տալ հրապարակողին խմբագրելու այս գրառումը","delete_topic_disallowed_modal":"Դուք թույլտվություն չունեք ջնջելու այս թեման: Եթե Դուք իսկապես ցանկանում եք, որ այն ջնջվի, դրոշակավորեք այն պատճառաբանության հետ միասին՝ մոդերատորի ուշադրությանը գրավելու համար:","delete_topic_disallowed":"Դուք թույլտվություն չունեք ջնջելու այս թեման","delete_topic":"ջնջել թեման"},"actions":{"flag":"Դրոշակավորել","defer_flags":{"one":"Անտեսել դրոշակը","other":"Անտեսել դրոշակավորումները"},"undo":{"off_topic":"Ետարկել Դրոշակավորումը","spam":"Ետարկել Դրոշակավորումը","inappropriate":"Ետարկել Դրոշակավորումը","bookmark":"Ետարկել էջանշումը","like":"Ետարկել հավանումը"},"people":{"off_topic":"դրոշակավորել է սա որպես թեմայից դուրս","spam":"դրոշակավորել է սա որպես սպամ","inappropriate":"դրոշակավորել է սա որպես անհամապատասխան","notify_moderators":"ծանուցել է մոդերատորներին","notify_user":"ուղարկել է հաղորդագրություն","bookmark":"էջանշել է սա","like_capped":{"one":"և {{count}} այլ անձ հավանել է սա","other":"և {{count}} հոգի հավանել են սա"}},"by_you":{"off_topic":"Դուք դրոշակավորել եք սա որպես թեմայից դուրս","spam":"Դուք դրոշակավորել եք սա որպես սպամ","inappropriate":"Դուք դրոշակավորել եք սա որպես անհամապատասխան","notify_moderators":"Դուք դրոշակավորել եք սա մոդերացիայի համար","notify_user":"Դուք ուղարկել եք հաղորդագրություն այս օգտատիրոջը","bookmark":"Դուք էջանշել եք այս գրառումը","like":"Դուք հավանել եք սա"}},"delete":{"confirm":{"one":"Դուք համոզվա՞ծ եք, որ ցանկանում եք ջնջել այդ հրապարակումը:","other":"Դուք համոզվա՞ծ եք, որ ցանկանում եք ջնջել այդ{{count}} գրառումները:"}},"merge":{"confirm":{"one":"Դուք համոզվա՞ծ եք, որ ցանկանում եք միավորել այդ հրապարակումները:","other":"Դուք համոզվա՞ծ եք, որ ցանկանում եք միավորել այդ {{count}} գրառումները:"}},"revisions":{"controls":{"first":"Առաջին խմբագրությունը","previous":"Նախորդ խմբագրությունը","next":"Հաջորդ խմբագրությունը","last":"Վերջին խմբագրությունը","hide":"Թաքցնել խմբագրությունը","show":"Ցուցադրել խմբագրությունը","revert":"Վերադարձնել այս խմբագրությանը","edit_wiki":"Խմբագրել Wiki-ն","edit_post":"Խմբագրել Գրառումը","comparing_previous_to_current_out_of_total":"\u003cstrong\u003e{{previous}}\u003c/strong\u003e {{icon}} \u003cstrong\u003e{{current}}\u003c/strong\u003e / {{total}}"},"displays":{"inline":{"title":"Ցուցադրել ստացված արդյունքը` հավելումներն ու հեռացումները մեկ տեղում","button":"HTML"},"side_by_side":{"title":"Ցուցադրել ստացված արդյունքի տարբերությունները կողք կողքի ","button":"HTML"},"side_by_side_markdown":{"title":"Ցուցադրել սկբնաղբյուրի տարբերությունները կողք կողքի","button":"Չֆորմատավորված"}}},"raw_email":{"displays":{"raw":{"title":"Ցուցադրել չֆորմատավորված էլ. նամակը","button":"Չֆորմատավորված"},"text_part":{"title":"Ցուցադրել էլ. նամակի տեքստային մասը","button":"Տեքստ"},"html_part":{"title":"Ցուցադրել էլ. նամակի html մասը","button":"HTML"}}},"bookmarks":{"created":"Ստեղծված","name":"Անուն"}},"category":{"can":"կարող է\u0026hellip; ","none":"(կատեգորիա չկա)","all":"Բոլոր կատեգորիաները","choose":"կատեգորիա\u0026hellip;","edit":"Խմբագրել","edit_dialog_title":"Խմբագրել՝ %{categoryName}","view":"Դիտել Կատեգորիայի Թեմաները","general":"Ընդհանուր","settings":"Կարգավորումներ","topic_template":"Թեմայի Ձևանմուշ","tags":"Թեգեր","tags_placeholder":"(Ընտրովի) թույլատրված թեգերի ցանկը","tag_groups_placeholder":"(Ընտրովի) թույլատրված թեգերի խմբերի ցանկը","topic_featured_link_allowed":"Թույլատրել հանրահայտ հղումները այս կատեգորիայում","delete":"Ջնջել Կատեգորիան","create":"Նոր Կատեգորիա","create_long":"Ստեղծել նոր Կատեգորիա","save":"Պահել Կատեգորիան","slug":"Կատեգորիայի Սլագը","slug_placeholder":"(Ընտրովի) գծիկավոր-բառեր url-ի համար","creation_error":"Կատեգորիայի ստեղծման ժամանակ տեղի է ունեցել սխալ:","save_error":"Կատեգորիան պահելիս տեղի է ունեցել սխալ:","name":"Կատեգորիայի Անունը","description":"Նկարագրույթուն","topic":"կատեգորիայի թեմա","logo":"Կատեգորիայի Լոգոյի Նկարը","background_image":"Կատեգորիայի Ֆոնի Նկարը","badge_colors":"Կրծքանշանի գույները","background_color":"Ֆոնի գույնը","foreground_color":"Առաջին պլանի գույնը","name_placeholder":"Առավելագույնը մեկ կամ երկու բառ","color_placeholder":"Ցանկացած վեբ-գույն","delete_confirm":"Դուք համոզվա՞ծ եք, որ ցանկանում եք ջնջել այս կատեգորիան:","delete_error":"Այս կատեգորիան ջնջելիս սխալ է տեղի ունեցել:","list":"Ցուցադրել Կատեգորիաները","no_description":"Խնդրում ենք այս կատեգորիայի համար ավելացնել նկարագրություն:","change_in_category_topic":"Խմբագրել Նկարագրությունը","already_used":"Այս գույնը օգտագործվել է մեկ այլ կատեգորիայի կողմից","security":"Անվտանգություն","special_warning":"Ուշադրություն. Այս կատեգորիան նախապես ստեղծված կատեգորիա է, և անվտանգության կարգավորումները չեն կարող փոփոխվել: Եթե Դուք չեք ցանկանում օգտագործել այս կատեգորիան, ջնջեք այն՝ փոփոխելու փոխարեն:","uncategorized_security_warning":"Այս կատեգորիան հատուկ է: Այն նախատեսված է որպես կատեգորիա չունեցող թեմաների պահման տարածք; այն չի կարող ունենալ անվտանգության կարգավորումներ:","uncategorized_general_warning":"Այս կատեգորիան հատուկ է: Այն օգտագործվում է որպես լռելյայն կատեգորիա նոր թեմաների համար, որոնք չունեն ընտրված կատեգորիա: Եթե Դուք ցանկանում եք կանխել սա և պարտադրել կատեգորիայի ընտրությունը, \u003ca href=\"%{settingLink}\"\u003eխնդրում ենք անջատել կարգավորումը այստեղ\u003c/a\u003e: Եթե ցանկանում եք փոփոխել անունը կամ նկարագրությունը, այցելեք \u003ca href=\"%{customizeLink}\"\u003eCustomize / Text Content\u003c/a\u003e:","images":"Նկարներ","email_in":"Անհատական մուտքային էլ. հասցե՝","email_in_allow_strangers":"Ընդունել էլ. նամակներ հաշիվ չունեցող անանուն օգտատերերից","email_in_disabled":"Էլ. փոստի միջոցով նոր թեմաների հրապարակումը անջատված է Կայքի Կարգավորումներում: Էլ. փոստի միջոցով նոր թեմաների հրապարակումը միացնելու համար, ","email_in_disabled_click":"միացրեք \"email in\" կարգավորումը:","mailinglist_mirror":"Կատեգորիան արտապատճենում է փոստային ցուցակ","show_subcategory_list":"Այս կատեգորիայում ցուցադրել ենթակատեգորիաների ցանկը թեմաների վերևում:","num_featured_topics":"Կատեգորիաների էջում ցուցադրվող թեմաների քանակը՝","subcategory_num_featured_topics":"Մայր կատեգորիայի էջում հանրահայտ թեմաների քանակը","all_topics_wiki":"Դարձնել նոր թեմաները wiki լռելյայն","subcategory_list_style":"Ենթակատեգորիաների Ցանկի Ոճը՝","sort_order":"Թեմաների Ցանկը Դասավորել Ըստ՝","default_view":"Լռելյայն Թեմաների Ցանկը՝","default_top_period":"Լռելյայն թոփ ժամանակահատվածը՝","allow_badges_label":"Այս կատեգորիայում թույլ տալ կրծքանշանների շնորհումը","edit_permissions":"Խմբագրել Թույլտվությունները","review_group_name":"խմբի անունը","require_topic_approval":"Բոլոր նոր թեմաների համար պահանջել մոդերատորի հաստատումը","require_reply_approval":"Բոլոր նոր պատասխանների համար պահանջել մոդերատորի հաստատումը ","this_year":"այս տարի","default_position":"Լռելյայն Դիրքը","position_disabled":"Կատեգորիաները կցուցադրվեն ըստ ակտիվության: Ցանկերում կատեգորիաների դասավորությունը վերահսկելու համար,","position_disabled_click":"միացրեք \"fixed category positions\" կարգավորումը:","minimum_required_tags":"Թեմայում պահանջվող թեգերի նվազագույն քանակը՝","parent":"Մայր Կատեգորիա","num_auto_bump_daily":"Օրեկան ավտոմատ բարձրացվող բաց թեմաների քանակը՝","navigate_to_first_post_after_read":"Բոլոր թեմաները կարդալուց հետո տեղափոխվել դեպի առաջին գրառում","notifications":{"watching":{"title":"Դիտում Եմ","description":"Դուք ավտոմատ կերպով կդիտեք այս կատեգորիաների բոլոր թեմաները: Դուք ծանուցում կստանաք յուրաքանչյուր թեմայում յուրաքանչյուր նոր գրառման համար, և կցուցադրվի նոր պատասխանների քանակը:"},"watching_first_post":{"title":"Դիտում Եմ Առաջին Գրառումը","description":"Դուք ծանուցում կստանաք այս կատեգորիայում նոր թեմաների, բայց ոչ այս թեմայի պատասխանների մասին:"},"tracking":{"title":"Հետևում Եմ","description":"Դուք ավտոմատ կերպով կհետևեք այս կատեգորիաների բոլոր թեմաներին: Դուք ծանուցում կստանաք, եթե որևէ մեկը հիշատակի Ձեր @անունը կամ պատասխանի Ձեզ, և կցուցադրվի նոր պատասխանների քանակը:"},"regular":{"title":"Նորմալ","description":"Դուք ծանուցում կստանաք, եթե որևէ մեկը հիշատակի Ձեր @անունը կամ պատասխանի Ձեզ:"},"muted":{"title":"Խլացված","description":"Դուք երբեք ծանուցում չեք ստանա այս կատեգորիաների նոր թեմաների մասին, և դրանք չեն հայտնվի վերջիններում:"}},"search_priority":{"label":"Որոնման Առաջնահերթություն","options":{"normal":"Նորմալ","ignore":"Անտեսել","very_low":"Շատ Ցածր","low":"Բարձր","high":"Ցածր","very_high":"Շատ Բարձր"}},"sort_options":{"default":"լռելյայն","likes":"Հավանումների","op_likes":"Սկզբնական Գրառման Հավանումների","views":"Դիտումների","posts":"Գրառումների","activity":"Ակտիվության","posters":"Հրապարակողների","category":"Կատեգորիաների","created":"Ստեղծման","votes":"Քվեներ"},"sort_ascending":"Ըստ աճման","sort_descending":"Ըստ նվազման","subcategory_list_styles":{"rows":"Տողերը","rows_with_featured_topics":"Հանրահայտ թեմաներ պարունակող տողերը","boxes":"Արկղերը","boxes_with_featured_topics":"Հանրահայտ թեմաներ պարունակող արկղերը"},"settings_sections":{"general":"Ընդհանուր","moderation":"Մոդերացիա","email":"Էլ. հասցե"}},"flagging":{"title":"Շնորհակալ ենք, որ օգնում եք պահել մեր համայնքը քաղաքակիրթ:","action":"Դրոշակավորել Գրառումը","take_action":"Ձեռնարկել Գործողություն","notify_action":"Հաղորդագրություն","official_warning":"Պաշտոնական Զգուշացում","delete_spammer":"Ջնջել Սպամ տարածողին","yes_delete_spammer":"Այո, Ջնջել Սպամ տարածողին","ip_address_missing":"(անհասանելի)","hidden_email_address":"(թաքցված)","submit_tooltip":"Կիրառել գաղտնի դրոշակ","take_action_tooltip":"Անմիջապես հասնել դրոշակների քանակի սահմանին՝ առանց սպասելու համայնքային ավելի շատ դրոշակների","cant":"Ներողություն, Դուք չեք կարող դրոշակավորել այս գրառումը այս պահին:","notify_staff":"Գաղտնի ծանուցում ուղարկել անձնակազմին","formatted_name":{"off_topic":"Դա Թեմայից Դուրս է","inappropriate":"Դա Անհամապատասխան է","spam":"Դա Սպամ է"},"custom_placeholder_notify_user":"Եղեք բնորոշ, կառուցողական և միշտ հարգալից:","custom_placeholder_notify_moderators":"Տեղեկացրեք մեզ հատկապես, թե ինչի մասին եք Դուք մտահոգված, և տրամադրեք համապատասխան հղումներ և օրինակներ, եթե հնարավոր է:","custom_message":{"at_least":{"one":"մուտքագրեք առնվազն %{count} սիմվոլ","other":"մուտքագրեք առնվազն {{count}} սիմվոլ"},"more":{"one":"%{count} ևս...","other":"ևս {{count}} շարունակելու համար..."},"left":{"one":"%{count}-ը մնում է","other":"{{count}} հատ է մնացել"}}},"flagging_topic":{"title":"Շնորհակալ ենք, որ օգնում եք պահել մեր համայնքը քաղաքակիրթ:","action":"Դրոշակավորել Թեման","notify_action":"Հաղորդագրություն"},"topic_map":{"title":"Թեմայի Ամփոփումը","participants_title":"Հաճախակի Հրապարակողներ","links_title":"Տարածված Հղումներ","links_shown":"ցուցադրել ավելի շատ հղումներ...","clicks":{"one":"%{count} սեղմում","other":"%{count} սեղմում"}},"post_links":{"about":"Ցուցադրել ավելի շատ հղումներ այս գրառման համար","title":{"one":"ևս %{count}","other":"ևս %{count}"}},"topic_statuses":{"warning":{"help":"Սա պաշտոնական զգուշացում է:"},"bookmarked":{"help":"Դուք էջանշել եք այս թեման"},"locked":{"help":"Այս թեման փակված է; այն այլևս չի կարող ընդունել նոր պատասխաններ"},"archived":{"help":"Այս թեման արխիվացված է; այն սառեցված է և չի կարող փոփոխվել:"},"locked_and_archived":{"help":"Այս թեման փակված և արխիվացված է; այն այլևս չի կարող ընդունել նոր պատասխաններ և չի կարող փոփոխվել:"},"unpinned":{"title":"Ապակցված","help":"Այս թեման ապակցված է Ձեզ համար; այն կցուցադրվի սովորական հերթականությամբ:"},"pinned_globally":{"title":"Ամրակցված Գլոբալ Կերպով","help":"Այս թեման ամրակցված է գլոբալ կերպով; այն կցուցադրվի վերջինների և իր կատեգորիայի վերևում"},"pinned":{"title":"Ամրակցված","help":"Այս թեման ամրակցված է Ձեզ համար; այն կցուցադրվի իր կատեգորիայի վերևում"},"unlisted":{"help":"Այս թեման հանված է ցանկից; այն չի ցուցադրվի թեմաների ցանկերում, և կարող է հասանելի լինել միայն ուղղակի հղումով"}},"posts":"Գրառումներ","posts_long":"այս թեմայում կա {{number}} գրառում","original_post":"Սկզբնական Գրառումը","views":"Դիտում","views_lowercase":{"one":"դիտում","other":"դիտում"},"replies":"Պատասխան","views_long":{"one":"այս թեման դիտվել է %{count} անգամ","other":"այս թեման դիտվել է {{number}} անգամ"},"activity":"Ակտիվություն","likes":"Հավանում","likes_lowercase":{"one":"հավանում","other":"հավանում"},"likes_long":"այս թեմայում կա {{number}} հավանում","users":"Օգտատեր","users_lowercase":{"one":"օգտատեր","other":"օգտատերեր"},"category_title":"Կատեգորիա","history":"Պատմություն","changed_by":"{{author}}-ի կողմից","raw_email":{"title":"Մուտքային Էլ. նամակ","not_available":"Հասանելի չէ!"},"categories_list":"Կատեգորիաների Ցանկ","filters":{"with_topics":"%{filter} թեմա","with_category":"%{filter} %{category} թեմա","latest":{"title":"Վերջինները","title_with_count":{"one":"Վերջին ({{count}})","other":"Վերջինները ({{count}})"},"help":"վերջերս կատարված գրառումներով թեմաները"},"read":{"title":"Կարդացած","help":"Ձեր կարդացած թեմաները այն հերթականությամբ, որով Դուք վերջին անգամ կարդացել եք դրանք"},"categories":{"title":"Կատեգորիաներ","title_in":"Կատեգորիա - {{categoryName}}","help":"ըստ կատեգորիայի խմբավորված բոլոր թեմաները"},"unread":{"title":"Չկարդացած","title_with_count":{"one":"Չկարդացած (%{count})","other":"Չկարդացած ({{count}})"},"help":"չկարդացած գրառումներով թեմաները, որոնց Դուք այժմ դիտում եք կամ հետևում եք","lower_title_with_count":{"one":"%{count} չկարդացած","other":"{{count}} չկարդացած"}},"new":{"lower_title_with_count":{"one":"%{count} նոր","other":"{{count}} նոր"},"lower_title":"նոր","title":"Նոր","title_with_count":{"one":"Նոր (%{count})","other":"Նոր ({{count}})"},"help":"վերջին մի քանի օրվա ընթացքում ստեղծված թեմաներ"},"posted":{"title":"Իմ Գրառումները","help":"թեմաները, որտեղ Դուք գրառում եք կատարել"},"bookmarks":{"title":"Էջանշաններ","help":"թեմաները, որոնք Դուք էջանշել եք"},"category":{"title":"{{categoryName}}","title_with_count":{"one":"{{categoryName}} (%{count})","other":"{{categoryName}} ({{count}})"},"help":"{{categoryName}} կատեգորիայի վերջին թեմաները"},"top":{"title":"Թոփ","help":"վերջին տարվա, ամսվա, շաբաթվա կամ օրվա ընթացքում ամենաակտիվ թեմաները","all":{"title":"Ամբողջ Ժամանակ"},"yearly":{"title":"Տարվա Ընթացքում"},"quarterly":{"title":"Եռամսյակի Ընթացքում"},"monthly":{"title":"Ամսվա Ընթացքում"},"weekly":{"title":"Շաբաթվա Ընթացքում"},"daily":{"title":"Օրվա Ընթացքում"},"all_time":"Ամբողջ ժամանակ","this_year":"Տարի","this_quarter":"Եռամսյակ","this_month":"Ամիս","this_week":"Շաբաթ","today":"Այսօր","other_periods":"տեսնել թոփը"},"votes":{"title":"Քվեներ","help":"ամենաշատ քվեներով թեմաները"}},"browser_update":"Ցավոք, \u003ca href=\"https://www.discourse.org/faq/#browser\"\u003eՁեր բրաուզերը չափազանց հին է այս կայքն օգտագործելու համար\u003c/a\u003e: Խնդրում ենք \u003ca href=\"https://browsehappy.com\"\u003eթարմացնել Ձեր բրաուզերը\u003c/a\u003e:","permission_types":{"full":"Ստեղծել/Պատասխանել/Դիտել","create_post":"Պատասխանել/Դիտել","readonly":"Դիտել"},"lightbox":{"download":"ներբեռնել"},"keyboard_shortcuts_help":{"title":"Ստեղնաշարի Համադրություններ","jump_to":{"title":"Ցատկել Դեպի","home":"%{shortcut} Գլխավոր էջ","latest":"%{shortcut} Վերջինները","new":"%{shortcut} Նոր","unread":"%{shortcut} Չկարդացած","categories":"%{shortcut} Կատեգորիաներ","top":"%{shortcut} Թոփ","bookmarks":"%{shortcut} Էջանշաններ","profile":"%{shortcut} Պրոֆիլ","messages":"%{shortcut} Հաղորդագրություններ","drafts":"%{shortcut} Սևագրեր"},"navigation":{"title":"Նավիգացիա","jump":"%{shortcut} Գնալ դեպի գրառում # ","back":"%{shortcut} Ետ","up_down":"%{shortcut} Տեղաշարժել նշվածը \u0026uarr; \u0026darr;","open":"%{shortcut} Բացել ընտրված թեման","next_prev":"%{shortcut} Հաջորդ/նախորդ բաժին"},"application":{"title":"Հավելված","create":"%{shortcut} Ստեղծել նոր թեմա","notifications":"%{shortcut} Բացել ծանուցումները","hamburger_menu":"%{shortcut} Բացել համբուրգեր մենյուն","user_profile_menu":"%{shortcut} Բացել օգտատիրոջ մենյուն","show_incoming_updated_topics":"%{shortcut} Ցուցադրել թարմացված թեմաները","search":"%{shortcut} Որոնել","help":"%{shortcut} Բացել ստեղնաշարի օգնականը","dismiss_new_posts":"%{shortcut} Չեղարկել Նոր/Գրառումները","dismiss_topics":"%{shortcut} Չեղարկել Թեմաները","log_out":"%{shortcut} Ելք"},"composing":{"title":"Կազմում","return":"%{shortcut} Վերադառնալ կոմպոզերին","fullscreen":"%{shortcut} Ամբողջական էկրանով կոմպոզեր"},"actions":{"title":"Գործողություններ","bookmark_topic":"%{shortcut} Փոխանջատել թեմայի էջանշանը","pin_unpin_topic":"%{shortcut} Ամրակցել/Ապակցել թեման","share_topic":"%{shortcut} Կիսվել թեմայով","share_post":"%{shortcut} Կիսվել գրառմամբ","reply_as_new_topic":"%{shortcut} Պատասխանել որպես կապված թեմա","reply_topic":"%{shortcut} Պատասխանել թեմային","reply_post":"%{shortcut} Պատասխանել գրառմանը","quote_post":"%{shortcut} Մեջբերել գրառումը","like":"%{shortcut} Հավանել գրառումը","flag":"%{shortcut} Դրոշակավորել գրառումը","bookmark":"%{shortcut} Էջանշել գրառումը","edit":"%{shortcut} Խմբագրել գրառումը","delete":"%{shortcut} Ջնջել գրառումը","mark_muted":"%{shortcut} Խլացնել թեման","mark_regular":"%{shortcut} Սովորական (լռելյայն) թեմա","mark_tracking":"%{shortcut} Հետևել թեմային","mark_watching":"%{shortcut} Դիտել թեման","print":"%{shortcut} Տպել թեման"}},"badges":{"earned_n_times":{"one":"Վաստակել է այս կրծքանշանը %{count} անգամ","other":"Վաստակել է այս կրծքանշանը %{count} անգամ"},"granted_on":"Շնորհված է %{date}","others_count":"Այս կրծքանշանով այլոք (%{count})","title":"Կրծքանշաններ","allow_title":"Դուք կարող եք օգտագործել այս կրծքանշանը որպես վերնագիր","multiple_grant":"Դուք կարող եք վաստակել սա բազմակի անգամ","badge_count":{"one":"%{count} Կրծքանշան","other":"%{count} Կրծքանշան"},"more_badges":{"one":"+%{count} Ավելի","other":"+ևս %{count}"},"granted":{"one":"%{count} շնորհված","other":"%{count} շնորհված"},"select_badge_for_title":"Ընտրեք կրծքանշան՝ որպես Ձեր վերնագիր օգտագործելու համար","none":"(ոչ մի)","successfully_granted":"%{badge}-ը հաջողությամբ շնորհված է %{username}-ին","badge_grouping":{"getting_started":{"name":"Սկսել"},"community":{"name":"Համայնք"},"trust_level":{"name":"Վստահության Մակարդակ"},"other":{"name":"Այլ"},"posting":{"name":"Հրապարակում"}}},"tagging":{"all_tags":"Բոլոր Թեգերը","other_tags":"Այլ Թեգեր","selector_all_tags":"բոլոր թեգերը","selector_no_tags":"առանց թեգերի","changed":"փոփոխված թեգերը՝ ","tags":"Թեգեր","choose_for_topic":"ընտրովի թեգեր","add_synonyms":"Ավելացնել","delete_tag":"Ջնջել Թեգը","delete_confirm":{"one":"Դուք համոզվա՞ծ եք, որ ցանկանում եք ջնջել այս թեգը և հեռացնել այն %{count} թեմայից, որին այն վերագրված է:","other":"Դուք համոզվա՞ծ եք, որ ցանկանում եք ջնջել այս թեգը և հեռացնել այն {{count}} թեմայից, որոնց այն վերագրված է:"},"delete_confirm_no_topics":"Դուք համոզվա՞ծ եք, որ ցանկանում եք ջնջել այս թեգը:","rename_tag":"Վերանվանել Թեգը","rename_instructions":"Ընտրեք նոր անուն թեգի համար՝ ","sort_by":"Դասավորել ըստ՝ ","sort_by_count":"քանակի","sort_by_name":"անվան","manage_groups":"Կառավարել Թեգերի Խմբերը","manage_groups_description":"Սահմանեք խմբեր՝ թեգերը համակարգելու համար","upload":"Վերբեռնել Թեգեր","upload_description":"Վերբեռնեք csv ֆայլ՝ զանգվածային կերպով թեգեր ստեղծելու համար","upload_instructions":"Յուրաքանչյուր տեղում մեկ հատ, ըստ ցանկության՝ նաև թեգերի խմբով, 'tag_name,tag_group' ֆորմատով:","upload_successful":"Թեգերը հաջողությամբ վերբեռնված են","delete_unused_confirmation":{"one":"%{count} թեգ կջնջվի՝%{tags}","other":"%{count} թեգ կջնջվի՝ %{tags}"},"delete_unused_confirmation_more_tags":{"one":"%{tags} և ևս %{count} ","other":"%{tags} և ևս %{count}"},"delete_unused":"Ջնջել Չօգտագործված Թեգերը","delete_unused_description":"Ջնջել բոլոր թեգերը, որոնք կցված չեն որևէ թեմայի կամ անձնական հաղորդագրության","cancel_delete_unused":"Չեղարկել","filters":{"without_category":"%{filter} %{tag} թեմա","with_category":"%{filter} %{tag} թեմա %{category}-ում","untagged_without_category":"%{filter} առանց թեգի թեմա","untagged_with_category":"%{filter}առանց թեգի թեմա %{category}-ում"},"notifications":{"watching":{"title":"Դիտում Եմ","description":"Դուք ավտոմատ կերպով կդիտեք այս թեգով բոլոր թեմաները: Դուք ծանուցում կստանաք բոլոր գրառումների և թեմաների մասին, ավելին՝ չկարդացած և նոր գրառումների քանակը նույնպես կհայտնվի թեմայի կողքին: "},"watching_first_post":{"title":"Դիտում Եմ Առաջին Գրառումը","description":"Դուք ծանուցում կստանաք այս թեգով նոր թեմաների, բայց ոչ թեմաների պատասխանների մասին:"},"tracking":{"title":"Հետևում Եմ","description":"Դուք ավտոմատ կերպով կհետևեք այս թեգով բոլոր թեմաներին: Չկարդացած և նոր գրառումների քանակը կհայտնվի թեմայի կողքին:"},"regular":{"title":"Սովորական","description":"Դուք ծանուցում կստանաք, եթե որևէ մեկը հիշատակի Ձեր @անունը կամ պատասխանի Ձեր հրապարակմանը:"},"muted":{"title":"Խլացված","description":"Դուք ծանուցում չեք ստանա այս թեգով որևէ նոր թեմայի մասին, և դրանք չեն հայտնվի Ձեր չկարդացածների ցանկում:"}},"groups":{"title":"Թեգավորել Խմբերը","about":"Ավելացրեք թեգեր խմբերին՝ դրանք ավելի հեշտ կառավարելու համար:","new":"Նոր Խումբ","tags_label":"Այս խմբի թեգերը՝ ","parent_tag_label":"Մայր թեգ՝ ","parent_tag_placeholder":"Ընտրովի","parent_tag_description":"Այս խմբի թեգերը չեն կարող օգտագործվել, քանի դեռ մայր թեգը առկա չէ:","one_per_topic_label":"Սահմանափակել այս խմբի յուրաքանչյուր թեման մեկ թեգով:","new_name":"Նոր Թեգի Խումբ","save":"Պահպանել","delete":"Ջնջել","confirm_delete":"Դուք համոզվա՞ծ եք, որ ցանկանում եք ջնջել այս թեգի խումբը:","everyone_can_use":"Թեգերը կարող են օգտագործվել բոլորի կողմից:","usable_only_by_staff":"Թեգերը տեսանելի են բոլորին, սակայն միայն անձնակազմը կարող է օգտագործել դրանք:","visible_only_to_staff":"Թեգերը տեսանելի են միայն անձնակազմին:"},"topics":{"none":{"unread":"Դուք չունեք չկարդացած թեմաներ:","new":"Դուք չունեք նոր թեմաներ:","read":"Դուք դեռևս չեք կարդացել որևէ թեմա:","posted":"Դուք դեռևս գրառում չեք կատարել որևէ թեմայում:","latest":"Վերջերս հրապարակված թեմաներ չկան:","bookmarks":"Դուք դեռևս չունեք էջանշած թեմաներ:","top":"Թոփ թեմաներ չկան:"},"bottom":{"latest":"Վերջերս հրապարակված թեմաներ այլևս չկան:","posted":"Հրապարակված թեմաներ այլևս չկան:","read":"Կարդացած թեմաներ այլևս չկան:","new":"Նոր թեմաներ այլևս չկան:","unread":"Չկարդացած թեմաներ այլևս չկան:","top":"Թոփ թեմաներ այլևս չկան:","bookmarks":"Էջանշած թեմաներ այլևս չկան:"}}},"invite":{"custom_message":"Դարձրեք Ձեր հրավերը ավելի անձնական՝ գրելով \u003ca href\u003eանհատական հաղորդագրություն\u003c/a\u003e:","custom_message_placeholder":"Մուտքագրեք Ձեր անհատական հաղորդագրությունը","custom_message_template_forum":"Հեյ, Դուք պետք է միանաք այս ֆորումին!","custom_message_template_topic":"Հեյ, ես կարծում եմ, որ Ձեզ դուր կգա այս թեման!"},"forced_anonymous":"Չափազանց մեծ բեռնման շնորհիվ սա ժամանակավորապես ցուցադրվում է բոլորին այնպես, ինչպես այն կտեսներ դուրս գրված օգտատերը:","safe_mode":{"enabled":"Անվտանգ ռեժիմը միացված է, փակեք բրաուզերի այս պատուհանը՝ անվտանգ ռեժիմից դուրս գալու համար:"},"poll":{"voters":{"one":"քվեարկող","other":"քվեարկող"},"total_votes":{"one":"ընդհանուր քվեարկող","other":"ընդհանուր քվեները"},"average_rating":"Միջին գնահատականը՝ \u003cstrong\u003e%{average}\u003c/strong\u003e:","public":{"title":"Քվեները \u003cstrong\u003eհանրային\u003c/strong\u003e են:"},"results":{"vote":{"title":"Արդյունքները կցուցադրվեն ըստ \u003cstrong\u003eքվեի\u003c/strong\u003e:"},"closed":{"title":"Արդյունքները կցուցադրվեն \u003cstrong\u003eփակվելուց\u003c/strong\u003e անմիջապես հետո:"}},"multiple":{"help":{"at_least_min_options":{"one":"Ընտրեք առնվազն \u003cstrong\u003e%{count}\u003c/strong\u003e տարբերակ","other":"Ընտրեք առնվազն \u003cstrong\u003e%{count}\u003c/strong\u003e տարբերակ"},"up_to_max_options":{"one":"Ընտրեք մինչև \u003cstrong\u003e%{count}\u003c/strong\u003e տարբերակ","other":"Ընտրեք մինչև \u003cstrong\u003e%{count}\u003c/strong\u003e տարբերակ"},"x_options":{"one":"Ընտրեք \u003cstrong\u003e%{count}\u003c/strong\u003e տարբերակ","other":"Ընտրեք \u003cstrong\u003e%{count}\u003c/strong\u003e տարբերակ"},"between_min_and_max_options":"Ընտրեք \u003cstrong\u003e%{min}\u003c/strong\u003e և \u003cstrong\u003e%{max}\u003c/strong\u003e տարբերակների միջև"}},"cast-votes":{"title":"Քվեարկեք","label":"Քվեարկեք հիմա !"},"show-results":{"title":"Ցուցադրել հարցման արդյունքները","label":"Ցուցադրել արդյունքները"},"hide-results":{"title":"Վերադառնալ դեպի Ձեր քվեները"},"export-results":{"label":"Արտահանել"},"open":{"title":"Բացել հարցումը","label":"Բացել","confirm":"Դուք համոզվա՞ծ եք, որ ցանկանում եք բացել այս հարցումը:"},"close":{"title":"Փակել հարցումը","label":"Փակել","confirm":" Դուք համոզվա՞ծ եք, որ ցանկանում եք փակել այս հարցումը:"},"automatic_close":{"closes_in":"Փակվում է \u003cstrong\u003e%{timeLeft}\u003c/strong\u003e անց:","age":"Փակված է՝ \u003cstrong\u003e%{age}\u003c/strong\u003e"},"error_while_toggling_status":"Ներողություն, այս հարցման կարգավիճակը փոխելիս տեղի է ունեցել սխալ:","error_while_casting_votes":"Ներողություն, Ձեր քվեարկելիս տեղի է ունեցել սխալ:","error_while_fetching_voters":"Ներողություն, քվեարկողներին ցուցադրելիս տեղի է ունեցել սխալ:","ui_builder":{"title":"Ստեղծել Հարցում","insert":"Ներմուծել Հարցում","help":{"invalid_values":"Նվազագույն արժեքը պետք է լինի առավելագույն արժեքից փոքր:","min_step_value":"Քայլի նվազագույն արժեքն է 1"},"poll_type":{"label":"Տիպը","regular":"Մեկ Ընտրությամբ","multiple":"Բազմակի Ընտրությամբ","number":"Թվային Գնահատում"},"poll_result":{"label":"Արդյունքները","always":"Միշտ տեսանելի","vote":"Ըստ քվեի","closed":"Փակվելուց հետո"},"poll_config":{"max":"Առավելագույնը","min":"Նվազագույնը","step":"Քայլը"},"poll_public":{"label":"Ցուցադրել քվեարկողներին"},"poll_options":{"label":"Մուտքագրեք հարցման մեկ տարբերակ յուրաքանչյուր տողում"},"automatic_close":{"label":"Ավտոմատ կերպով փակել հարցումը"}}},"discourse_narrative_bot":{"welcome_post_type":{"new_user_track":"Մեկնարկել նոր օգտատիրոջ ձեռնարկը բոլոր նոր օգտատերերի համար","welcome_message":"Բոլոր նոր օգտատերերին ուղարկել ողջույնի նամակ՝ արագ մեկնարկի հրահանգներով"}},"discourse_local_dates":{"relative_dates":{"today":"Այսօր %{time}","tomorrow":"Վաղը %{time}","yesterday":"Երեկ %{time}"},"create":{"form":{"insert":"Մուտքագրել","advanced_mode":"Ընդլայնված ռեժիմ","simple_mode":"Հասարակ ռեժիմ","format_description":"Օգտատիրոջը ամսաթվի ցուցադրման համար օգտագործված ֆորմատ: Օգտագործեք \"\\T\\Z\" ՝ օգտատիրոջ ժամային գոտին բառերով ցուցադրելու համար (Europe/Paris)","timezones_title":"Ցուցադրվող ժամային գոտիներ","timezones_description":"Ժամային գոտիները կօգտագործվեն նախադիտման և վերադարձի ժամանակ ամսաթվի ցուցադրման համար:","recurring_title":"Կրկնություն","recurring_description":"Սահմանեք իրադարձության կրկնությունը: Դուք կարող եք նաև ձեռքով խմբագրել էջի կողմից գեներացված կրկնության տարբերակը և օգտագործեք հետևյալ key-երից որևէ մեկը՝ տարիներ, եռամսյակներ, շաբաթներ, օրեր, ժամեր, րոպեներ, վայրկյաններ, միլիվայրկյաններ:","recurring_none":"Կրկնություն չկա","invalid_date":"Անվավեր ամսաթիվ, համոզվեք, որ ամսաթիվը և ժամը ճիշտ են","date_title":"Ամսաթիվ","time_title":"Ժամ","format_title":"Ամսաթվի ֆորմատ"}}},"details":{"title":"Թաքցնել Մանրամասները"},"presence":{"replying":"պատասխանում է","editing":"խմբագրում է","replying_to_topic":{"one":"պատասխանում է","other":"պատասխանում են"}},"voting":{"reached_limit":"Դուք գերազանցել եք քվեների քանակը, հեռացրեք որևէ գոյույթուն ունեցող քվե!","list_votes":"Ցուցակագրել Ձեր քվեները","votes_nav_help":"ամենաշատ քվեներով թեմաները","voted":"Դուք քվեարկել եք այս թեմայում","allow_topic_voting":"Թույլատրել օգտատերերին քվեարկել այս կատեգորիայի թեմաներում","vote_title":"Քվեարկել","vote_title_plural":"Քվե","voted_title":"Քվեարկած","voting_closed_title":"Փակված է","voting_limit":"Սահմանափակում","votes_left":{"one":"Դուք դեռևս ունեք {{count}} քվե, դիտեք \u003ca href='{{path}}'\u003eՁեր քվեները\u003c/a\u003e:","other":"Դուք դեռևս ունեք {{count}} քվե, դիտեք \u003ca href='{{path}}'\u003eՁեր քվեները\u003c/a\u003e:"},"votes":{"one":"{{count}} քվե","other":"{{count}} քվե"},"anonymous_button":{"one":"Քվեներ","other":"Քվեներ"}},"adplugin":{"advertisement_label":"ՀԱՅՏԱՐԱՐՈՒԹՅՈՒՆ"}}},"zh_CN":{"js":{"dates":{"time_short_day":"ddd, HH:mm","long_no_year":"M[月]D[日] HH:mm"},"action_codes":{"forwarded":"转发上述邮件"},"topic_admin_menu":"管理主题","themes":{"broken_theme_alert":"因为主题或组件%{theme}有错误，你的网站可能无法正常运行。 在%{path}禁用它。"},"s3":{"regions":{"us_gov_west_1":"AWS 政府云（US-West）"}},"bookmarked":{"help":{"unbookmark_with_reminder":"点击以移除该主题上的所有收藏和提醒。你在该主题中设定了一个于%{reminder_at}的提醒。"}},"bookmarks":{"created_with_reminder":"你已经收藏该帖并且设定了一个于%{date}的提醒","created_with_at_desktop_reminder":"你所收藏的此帖将会在你下次使用桌面设备时被提醒。","delete":"删除收藏","confirm_delete":"你确定要删除该收藏吗？你所设置的提醒也会被一并删除。","no_timezone":"你尚未设置时区。您将无法设置提醒。在 \u003ca href=\"%{basePath}/my/preferences/profile\"\u003e你的个人资料中\u003c/a\u003e设置。","invalid_custom_datetime":"你所提供的日期和时间无效，请重试。","list_permission_denied":"你没有权限查看该用户的收藏。","reminders":{"at_desktop":"下次我使用桌面设备时","next_business_day":"下一个工作日","start_of_next_business_week":"下周一","custom":"自定义日期和时间","last_custom":"最近","none":"无需提醒","today_with_time":"今天%{time}","tomorrow_with_time":"明天%{time}","at_time":"于%{date_time}","existing_reminder":"你为该收藏所设定的提醒将被发出"}},"choose_topic":{"title":{"search":"搜索主题","placeholder":"在此处输入主题标题、URL 或 ID"}},"choose_message":{"title":{"search":"搜索私信","placeholder":"在此处输入私信的标题、URL或ID"}},"review":{"explain":{"why":"解释为什么该项目最终进入队列","title":"需审核评分","subtotal":"小计","min_score_visibility":"可见的最低分数","score_to_hide":"隐藏帖子的分数","take_action_bonus":{"name":"立即执行","title":"当工作人员选择采取行动时，会给标记加分。"},"user_accuracy_bonus":{"name":"用户准确性","title":"先前已同意其标记的用户将获得奖励。"},"trust_level_bonus":{"name":"信任等级","title":"待审阅项目由较高信任级别且具有较高分数的用户创建的。"},"type_bonus":{"name":"奖励类型","title":"某些可审核类型可以由管理人员加权，以使其具有更高的优先级。"}},"claim_help":{"optional":"你可以认领此条目以避免被他人审核。","required":"在你审核之前你必须认领此条目。","claimed_by_you":"你已认领此条目现在可以审核了。","claimed_by_other":"此条目仅可被\u003cb\u003e{{username}}\u003c/b\u003e审核。"},"claim":{"title":"认领该主题"},"unclaim":{"help":"移除该认领"},"awaiting_approval":"需要审核","settings":{"saved":"已保存！","priorities":{"title":"需审核优先级"}},"view_all":"查看全部","grouped_by_topic":"依据主题分组","none":"没有项目需要审核","view_pending":"查看待审核","topic_has_pending":{"other":"该主题中有 \u003cb\u003e{{count}}\u003c/b\u003e 个帖等待审核中"},"title":"审核","filtered_topic":"您正在选择性地查看这一主题中的可审核内容。","show_all_topics":"显示所有主题","deleted_post":"(已删除的帖子)","deleted_user":"(已删除的用户)","user":{"bio":"简介","website":"网站","fields":"字段"},"user_percentage":{"summary":{"other":"{{agreed}}，{{disagreed}}，{{ignored}}（共{{count}}个标记）"},"agreed":{"other":"{{count}}%同意"},"disagreed":{"other":"{{count}}%不同意"},"ignored":{"other":"{{count}}%忽略"}},"topics":{"reported_by":"报告人","deleted":"[已删除的主题]","original":"（原主题）","unique_users":{"other":"{{count}} 位用户"}},"replies":{"other":"{{count}} 个回复"},"new_topic":"批准此条目将会创建一个新的主题","filters":{"type":{"all":"(全部类型)"},"minimum_score":"最低分：","status":"状态","orders":{"priority":"优先级","priority_asc":"优先级（倒序）","created_at":"创建时间","created_at_asc":"创建时间（倒序）"},"priority":{"title":"最低优先级","low":"（所有）","medium":"中"}},"conversation":{"view_full":"查看完整对话"},"scores":{"about":"该分数是根据报告者的信任等级、该用户以往举报的准确性以及被举报条目的优先级计算得出的。","status":"状态","submitted_by":"提交人","reviewed_by":"审核者"},"statuses":{"approved":{"title":"已批准"},"deleted":{"title":"已删除"},"reviewed":{"title":"（所有已审核）"},"all":{"title":"（全部）"}},"types":{"reviewable_flagged_post":{"title":"被标记的帖子","flagged_by":"标记者"},"reviewable_queued_topic":{"title":"队列中到主题"},"reviewable_queued_post":{"title":"队列中的帖子"}},"approval":{"pending_posts":{"other":"你有 \u003cstrong\u003e{{count}}\u003c/strong\u003e 个帖子在等待审核中。"}}},"directory":{"last_updated":"最近更新："},"groups":{"member_requested":"请求于","requests":{"title":"请求","accept":"接受","deny":"拒绝","denied":"已拒绝","undone":"撤销请求","handle":"处理成员请求"},"empty":{"requests":"没有请求加入此群组的请求。"},"confirm_leave":"你确定要离开这个群组吗？","allow_membership_requests":"允许用户向群组所有者发送成员资格请求（需要公开可见的群组）","members":{"forbidden":"你不可以查看成员列表。"},"alias_levels":{"owners_mods_and_admins":"仅群组成员、版主与管理员"}},"user":{"user_notifications":{"ignore_duration_title":"忽略计时器","ignore_duration_when":"持续时间：","ignore_duration_note":"请注意所有忽略的项目会在忽略的时间段过去后被自动移除","ignore_no_users":"你没有忽视任何用户","ignore_option_title":"你将不会收到关于此用户的通知并且隐藏其所有帖子及回复。","add_ignored_user":"添加...","mute_option_title":"你不会收到任何关于此用户的通知","normal_option_title":"如果用户回复、引用或提到你，你将会收到消息。"},"feature_topic_on_profile":{"open_search":"选择一个新主题","title":"选择一个主题","search_label":"通过标题搜索主题","clear":{"warning":"你确定要清除精选主题吗？"}},"use_current_timezone":"使用现在的时区","timezone":"时区","dynamic_favicon":"在浏览器图标上显示计数","enable_defer":"启用延迟以标记未读主题","featured_topic":"精选主题","muted_categories_instructions_dont_hide":"你将不会收到在这些分类中的新主题通知。","staff_counters":{"rejected_posts":"被驳回的帖子"},"second_factor_backup":{"manage":"管理备份码。你还剩下\u003cstrong\u003e{{count}}\u003c/strong\u003e个备份码。","use":"使用备份码","enable_prerequisites":"你必须在生成备份代码之前启用主要第二因素。"},"second_factor":{"enable":"管理两步验证","forgot_password":"忘记密码？","short_description":"使用一次性安全码保护你的账户。\n","use":"使用身份验证器应用","disable":"停用","disable_title":"禁用次要身份验证器","disable_confirm":"确定禁用所有的两步验证吗？","edit_title":"编辑次要身份验证器","edit_description":"次要身份验证器名称","enable_security_key_description":"当你准备好物理安全密钥后，请按下面的“注册”按钮。","totp":{"title":"基于凭证的身份验证器","add":"新增身份验证器","default_name":"我的身份验证器","name_and_code_required_error":"你必须提供你的身份验证器应用的名称和代码。"},"security_key":{"title":"安全密钥","add":"注册安全密钥","default_name":"主要安全密钥","not_allowed_error":"安全密钥注册过程已超时或被取消。","already_added_error":"你已注册此安全密钥，无需再次注册。","edit":"编辑安全密钥","edit_description":"安全密钥名称","name_required_error":"你必须提供安全密钥的名称。"}},"change_avatar":{"gravatar":"\u003ca href='//{{gravatarBaseUrl}}{{gravatarLoginUrl}}' target='_blank'\u003e{{gravatarName}}\u003c/a\u003e，基于","gravatar_title":"在{{gravatarName}}网站修改你的头像","gravatar_failed":"我们无法找到此电子邮件的{{gravatarName}}。","refresh_gravatar_title":"刷新你的{{gravatarName}}"},"change_profile_background":{"title":"个人档头部","instructions":"个人资料的页头会被居中显示且默认宽度为1110px。"},"change_featured_topic":{"title":"精选主题","instructions":"此主题的链接会显示在你的用户卡片和资料中。"},"associated_accounts":{"confirm_modal_title":"连接%{provider}帐号","confirm_description":{"account_specific":"你的%{provider}帐号“%{account_description}”会被用作认证。","generic":"你的%{provider}帐号会被用作认证。"}},"invite_code":{"title":"邀请码","instructions":"账户注册需要邀请码"},"title_count_mode":{"title":"背景页面标题显示计数：","notifications":"新通知","contextual":"新建页面内容"},"invited":{"sent":"上次发送"}},"modal":{"dismiss_error":"忽略错误"},"logs_error_rate_notice":{},"create_account":{"disclaimer":"注册即表示你同意\u003ca href='{{privacy_link}}' target='blank'\u003e隐私策略\u003c/a\u003e和\u003ca href='{{tos_link}}' target='blank'\u003e服务条款\u003c/a\u003e。"},"forgot_password":{"complete_username_found":"我们找到一个与用户名\u003cb\u003e%{username}\u003c/b\u003e匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。","complete_email_found":"我们找到一个与\u003cb\u003e%{email}\u003c/b\u003e相匹配的账户。你应该会收到一封说明如何重设密码的电子邮件。"},"email_login":{"logging_in_as":"用%{email}登录","confirm_button":"登录完成"},"login":{"second_factor_backup":"使用备用码登录","second_factor":"使用身份验证器app登录","security_key_description":"当你准备好物理安全密钥后，请按下面的“使用安全密钥进行身份验证”按钮。","security_key_alternative":"尝试另一种方式","security_key_authenticate":"使用安全密钥进行身份验证","security_key_not_allowed_error":"安全密钥验证超时或被取消。","security_key_no_matching_credential_error":"在提供的安全密钥中找不到匹配的凭据。","security_key_support_missing_error":"您当前的设备或浏览器不支持使用安全密钥。请使用其他方法。","cookies_error":"你的浏览器似乎禁用了Cookie。如果不先启用它们，你可能无法登录。","discord":{"title":"with Discord"}},"emoji_set":{"emoji_one":"JoyPixels （曾用名EmojiOne）"},"shortcut_modifier_key":{"enter":"回车"},"category_row":{"topic_count":"{{count}}个主题在此分类中"},"select_kit":{"invalid_selection_length":"选择的字符至少为{{count}}个字符。"},"date_time_picker":{"errors":{"to_before_from":"截至日期必须晚于开始日期。"}},"composer":{"reference_topic_title":"回复：{{title}}","error":{"post_missing":"帖子不能为空","topic_template_not_modified":"请通过编辑主题模板来为主题添加详情。"},"reply_placeholder_choose_category":"输入前请选择一个分类。","saved_draft":"正在发布草稿。点击以继续。","link_url_placeholder":"粘贴 URL 或键入以搜索主题","composer_actions":{"reply_as_new_topic":{"confirm":"您保存了新的主题草稿，如果您创建链接主题该草稿将被覆盖。"}}},"notifications":{"tooltip":{"high_priority":{"other":"%{count}个未读的高优先级通知"}},"post_approved":"你的帖子已被审核","reviewable_items":"待审核帖子","membership_request_accepted":"接受来自“{{group_name}}”的邀请","membership_request_consolidated":"{{count}}个加入“{{group_name}}”群组的请求","popup":{"custom":"来自{{username}}在%{site_title}的通知"},"titles":{"mentioned":"提及到","replied":"新回复","quoted":"引用","edited":"编辑","liked":"新到赞","private_message":"新私信","invited_to_private_message":"邀请进行私下交流","invitee_accepted":"邀请已接受","posted":"新帖子","moved_post":"帖子已移动","linked":"链接","bookmark_reminder":"收藏提醒","bookmark_reminder_with_name":"收藏提醒 - %{name}","granted_badge":"勋章授予","invited_to_topic":"邀请到主题","group_mentioned":"群组提及","group_message_summary":"新建群组消息","topic_reminder":"主题提醒","liked_consolidated":"新的赞","membership_request_consolidated":"新的成员申请"}},"search":{"context":{"tag":"搜索＃{{tag}}标签"},"advanced":{"filters":{"created":"我创建的"},"statuses":{"public":"是公开的"}}},"view_all":"查看全部","topic":{"defer":{"help":"标记为未读","title":"推迟处理"},"feature_on_profile":{"help":"添加此主题的链接到你的用户卡片和资料中。","title":"精选到个人资料"},"remove_from_profile":{"warning":"你的个人资料中已存在精选主题。如果继续，此主题会替换存在的主题。","help":"在你的个人资料中移除指向该主题的链接","title":"从个人资料中移除"},"group_request":"你需要请求加入`{{name}}`群组才能查看此主题。","group_join":"你需要加入`{{name}}`群组以查看此主题","group_request_sent":"你加入群组的请求已发送。当被接受时你会收到通知。","unread_indicator":"还没有成员读过此主题的最新帖子。","topic_status_update":{"num_of_days":"天数"},"auto_update_input":{"two_months":"两个月","four_months":"四个月"},"auto_delete_replies":{"title":"自动删除回复"},"status_update_notice":{"auto_delete_replies":"此主题的回复会在%{duration}后自动删除。"},"progress":{"jump_prompt_long":"跳到……"},"make_public":{"title":"转换到公开主题","choose_category":"请选择公共主题分类："},"publish_page":{"publish":"出版","description":"当一个主题被出版为一个页面时，其链接是共享的，并且会以自定义的样式显示。","slug":"Slug","publish_url":"你的页面已出版于：","topic_published":"你的主题已出版于：","preview_url":"你的页面将出版于：","invalid_slug":"抱歉，您不能出版此页面。","unpublish":"取消出版","unpublished":"你的页面已经取消出版并且不再可用。","publishing_settings":"出版设置"},"change_owner":{"instructions_without_old_user":{"other":"请为此{{count}}个帖子选择一个新的拥有者。"}},"deleted_by_author":{"other":"（主题被作者撤回，除非被标记，不然将在%{count}小时后自动删除）"}},"post":{"ignored":"忽视的内容","show_hidden":"显示已忽略内容。","abandon_edit":{"confirm":"您确定要放弃所做的更改吗？","no_save_draft":"不，保存草稿","yes_value":"是的，忽略编辑"},"abandon":{"no_save_draft":"不，保存草稿"},"controls":{"read_indicator":"阅读了帖子的用户","add_post_notice":"添加管理人员通知","remove_post_notice":"移除管理人员通知","remove_timer":"移除计时器"},"actions":{"people":{"like":{"other":"点赞"},"read":{"other":"看过"},"read_capped":{"other":"还有{{count}}个其他用户看过"}}},"bookmarks":{"create":"创建收藏夹","edit":"编辑收藏","name_placeholder":"这个收藏是做什么用的？","set_reminder":"提醒我","actions":{"delete_bookmark":{"name":"删除收藏","description":"从你的个人资料中删除收藏并停止所有有关该收藏的提醒"},"edit_bookmark":{"name":"编辑收藏","description":"编辑收藏名称或修改提醒的日期和时间"}}}},"category":{"tags_allowed_tags":"限制这些标签只能用在此分类","tags_allowed_tag_groups":"限制这些标签组只能用在此分类","tags_tab_description":"上面所指定的标签和标签组仅在此分类以及其它也指定了它们的分类中可用。它们将无法在其它分类中使用。","manage_tag_groups_link":"管理这里的标签组。","allow_global_tags_label":"也允许其它标签","tag_group_selector_placeholder":"（可选）标签组","required_tag_group_description":"要求新主题包含标签组中的标签：","min_tags_from_required_group_label":"标签数量：","required_tag_group_label":"标签组：","pending_permission_change_alert":"你还没有添加%{group}到此分类；点击此按钮添加。","reviewable_by_group":"管理人员之外，可以审核该分类中的帖子和标记的人：","position":"分类页面位置：","settings_sections":{"appearance":"主题"}},"topic_statuses":{"personal_message":{"title":"此主题是一条私信","help":"此主题是一条私信"}},"lightbox":{"previous":"上一个（左方向键）","next":"下一个（右方向键）","counter":"%curr% / %total%","close":"关闭(Esc)","content_load_error":"\u003ca href=\"%url%\"\u003e内容\u003c/a\u003e无法加载","image_load_error":"\u003ca href=\"%url%\"\u003e图像\u003c/a\u003e无法加载"},"keyboard_shortcuts_help":{"shortcut_key_delimiter_comma":"，","shortcut_key_delimiter_plus":"+","shortcut_delimiter_or":"%{shortcut1}或%{shortcut2}","shortcut_delimiter_slash":"%{shortcut1}/%{shortcut2}","shortcut_delimiter_space":"%{shortcut1}%{shortcut2}","navigation":{"go_to_unread_post":"%{shortcut}前往第一个未读帖子"},"bookmarks":{"title":"收藏","enter":"%{shortcut} 保存并关闭","later_today":"%{shortcut} 今天晚些时候","later_this_week":"%{shortcut} 本周的晚些时候","tomorrow":"%{shortcut} 明天","next_week":"%{shortcut} 下周","next_month":"%{shortcut} 下个月","next_business_week":"%{shortcut} 下周开始","next_business_day":"%{shortcut} 下个工作日","custom":"%{shortcut} 自定义日期和时间","none":"%{shortcut} 没有提醒","delete":"%{shortcut} 删除收藏"},"actions":{"defer":"%{shortcut}延迟主题","topic_admin_actions":"%{shortcut}打开主题管理"},"search_menu":{"title":"搜索菜单","prev_next":"%{shortcut}上下移动所选内容","insert_url":"%{shortcut}将选定内容插入到打开的编辑器"}},"tagging":{"info":"详情","default_info":"该标签不限于任何类别，并且没有同义词。","category_restricted":"此标签仅限于你无权访问的分类。","synonyms":"同义词","synonyms_description":"使用以下标签时，它们将被替换为\u003cb\u003e%{base_tag_name}\u003c/b\u003e 。","tag_groups_info":{"other":"此标签属于这些标签组：{{tag_groups}}。"},"category_restrictions":{"other":"只能在这些分类中使用："},"edit_synonyms":"管理同义词","add_synonyms_label":"添加同义词：","add_synonyms_explanation":{"other":"当前任何使用了此标签的地方都将被改为使用\u003cb\u003e%{tag_name}\u003c/b\u003e代替。你确定要应用此更改吗？"},"add_synonyms_failed":"不能将以下标记添加为同义词： \u003cb\u003e%{tag_names}\u003c/b\u003e 。确保它们没有同义词并且不是其他标签的同义词。","remove_synonym":"删除同义词","delete_synonym_confirm":"您确定要删除同义词“ %{tag_name}”吗？","delete_confirm_synonyms":{"other":"其{{count}}个同义词也将被删除。"},"groups":{"tags_placeholder":"标签","name_placeholder":"标签组名称"}},"poll":{"results":{"groups":{"title":"你需要成为 %{groups} 的一员才能投票。"},"staff":{"title":"结果仅显示给\u003cstrong\u003e管理\u003c/strong\u003e成员。"}},"hide-results":{"label":"显示投票"},"group-results":{"title":"按用户字段分组投票","label":"显示错误"},"ungroup-results":{"title":"合并所有投票","label":"隐藏错误"},"export-results":{"title":"到处投票结果"},"error_while_exporting_results":"抱歉，导出投票结果时出错。","ui_builder":{"help":{"options_count":"至少输入1个选项"},"poll_result":{"staff":"仅管理人员"},"poll_groups":{"label":"允许的群组"},"poll_chart_type":{"label":"图表类型"}}},"discourse_local_dates":{"relative_dates":{"countdown":{"passed":"日期已过"}},"title":"插入日期/时间","create":{"form":{"timezone":"时区","until":"直到......","recurring":{"every_day":"每天","every_week":"每周","every_two_weeks":"每两周","every_month":"每月","every_two_months":"每两个月","every_three_months":"每三个月","every_six_months":"每六个月","every_year":"每年"}}}},"voting":{"title":"投票","remove_vote":"移除投票"},"docker":{"upgrade":"当前使用 Discourse 的旧版本。","perform_upgrade":"点击这里升级。"}}},"en":{"js":{"review":{"topic_has_pending":{"one":"This topic has \u003cb\u003e%{count}\u003c/b\u003e post pending approval"},"user_percentage":{"summary":{"one":"{{agreed}}, {{disagreed}}, {{ignored}} ({{count}} total flag)"},"agreed":{"one":"{{count}}% agree"},"disagreed":{"one":"{{count}}% disagree"},"ignored":{"one":"{{count}}% ignore"}},"topics":{"unique_users":{"one":"%{count} user"}},"replies":{"one":"%{count} reply"},"approval":{"pending_posts":{"one":"You have \u003cstrong\u003e%{count}\u003c/strong\u003e post pending."}}},"user":{"change_password":{"emoji":"lock emoji"}},"local_time":"Local Time","email_login":{"emoji":"lock emoji"},"invites":{"emoji":"envelope emoji"},"notifications":{"tooltip":{"high_priority":{"one":"%{count} unread high priority notification"}}},"topic":{"publish_page":{"title":"Page Publishing"},"change_owner":{"instructions_without_old_user":{"one":"Please choose a new owner for the post"}},"deleted_by_author":{"one":"(topic withdrawn by author, will be automatically deleted in %{count} hour unless flagged)"}},"post":{"controls":{"publish_page":"Page Publishing"},"actions":{"people":{"like":{"one":"liked this"},"read":{"one":"read this"},"read_capped":{"one":"and {{count}} other read this"}}}},"tagging":{"tag_groups_info":{"one":"This tag belongs to the group \"{{tag_groups}}\"."},"category_restrictions":{"one":"It can only be used in this category:"},"add_synonyms_explanation":{"one":"Any place that currently uses this tag will be changed to use \u003cb\u003e%{tag_name}\u003c/b\u003e instead. Are you sure you want to make this change?"},"delete_confirm_synonyms":{"one":"Its synonym will also be deleted."}},"discourse_internet_explorer":{"deprecation_warning":"This site will soon remove support for Internet Explorer 11 - please update your browser"},"poll":{"ui_builder":{"poll_chart_type":{"bar":"Bar","pie":"Pie"}}},"admin":{"logs":{"staff_actions":{"actions":{"discourse_upgrade":"Upgrade to the Latest Version"}}}},"docker":{"link_to_upgrade":"Perform upgrades here."}}}};
I18n.locale = 'hy';
I18n.pluralizationRules.hy = MessageFormat.locale.hy;
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


    var hyAm = moment.defineLocale('hy-am', {
        months : {
            format: 'հունվարի_փետրվարի_մարտի_ապրիլի_մայիսի_հունիսի_հուլիսի_օգոստոսի_սեպտեմբերի_հոկտեմբերի_նոյեմբերի_դեկտեմբերի'.split('_'),
            standalone: 'հունվար_փետրվար_մարտ_ապրիլ_մայիս_հունիս_հուլիս_օգոստոս_սեպտեմբեր_հոկտեմբեր_նոյեմբեր_դեկտեմբեր'.split('_')
        },
        monthsShort : 'հնվ_փտր_մրտ_ապր_մյս_հնս_հլս_օգս_սպտ_հկտ_նմբ_դկտ'.split('_'),
        weekdays : 'կիրակի_երկուշաբթի_երեքշաբթի_չորեքշաբթի_հինգշաբթի_ուրբաթ_շաբաթ'.split('_'),
        weekdaysShort : 'կրկ_երկ_երք_չրք_հնգ_ուրբ_շբթ'.split('_'),
        weekdaysMin : 'կրկ_երկ_երք_չրք_հնգ_ուրբ_շբթ'.split('_'),
        longDateFormat : {
            LT : 'HH:mm',
            LTS : 'HH:mm:ss',
            L : 'DD.MM.YYYY',
            LL : 'D MMMM YYYY թ.',
            LLL : 'D MMMM YYYY թ., HH:mm',
            LLLL : 'dddd, D MMMM YYYY թ., HH:mm'
        },
        calendar : {
            sameDay: '[այսօր] LT',
            nextDay: '[վաղը] LT',
            lastDay: '[երեկ] LT',
            nextWeek: function () {
                return 'dddd [օրը ժամը] LT';
            },
            lastWeek: function () {
                return '[անցած] dddd [օրը ժամը] LT';
            },
            sameElse: 'L'
        },
        relativeTime : {
            future : '%s հետո',
            past : '%s առաջ',
            s : 'մի քանի վայրկյան',
            ss : '%d վայրկյան',
            m : 'րոպե',
            mm : '%d րոպե',
            h : 'ժամ',
            hh : '%d ժամ',
            d : 'օր',
            dd : '%d օր',
            M : 'ամիս',
            MM : '%d ամիս',
            y : 'տարի',
            yy : '%d տարի'
        },
        meridiemParse: /գիշերվա|առավոտվա|ցերեկվա|երեկոյան/,
        isPM: function (input) {
            return /^(ցերեկվա|երեկոյան)$/.test(input);
        },
        meridiem : function (hour) {
            if (hour < 4) {
                return 'գիշերվա';
            } else if (hour < 12) {
                return 'առավոտվա';
            } else if (hour < 17) {
                return 'ցերեկվա';
            } else {
                return 'երեկոյան';
            }
        },
        dayOfMonthOrdinalParse: /\d{1,2}|\d{1,2}-(ին|րդ)/,
        ordinal: function (number, period) {
            switch (period) {
                case 'DDD':
                case 'w':
                case 'W':
                case 'DDDo':
                    if (number === 1) {
                        return number + '-ին';
                    }
                    return number + '-րդ';
                default:
                    return number;
            }
        },
        week : {
            dow : 1, // Monday is the first day of the week.
            doy : 7  // The week that contains Jan 7th is the first week of the year.
        }
    });

    return hyAm;

})));

moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM YYYY'); };
moment.fn.longDate = function(){ return this.format('D MMMM YYYY LT'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
